// MeetingBot webhook receiver.
//
// PUBLIC endpoint (verify_jwt = false in config.toml) — authenticated by
// HMAC-SHA256 over the raw body using MEETINGBOT_WEBHOOK_SECRET. We
// short-circuit on missing/invalid signatures.
//
// MeetingBot delivers events of the form:
//   { event: "bot.done" | "bot.error" | ..., data: { bot_id, ... } }
//
// We resolve the local row by external_bot_id (with metadata.local_meeting_bot_id
// as a fallback), then patch transcript / summary / action_items /
// status. On `bot.done` with action_items, we optionally auto-create
// tasks (idempotent via tasks_created_at sentinel).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';
import {
  normaliseStatus,
  verifyHmac,
  type BotAnalysis,
  type TranscriptEntry,
} from '../_shared/meetingbot.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-meetingbot-signature, x-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const secret = Deno.env.get('MEETINGBOT_WEBHOOK_SECRET') || '';
    if (!secret) {
      console.error('[meeting-bot-webhook] no secret configured; refusing all deliveries');
      return json({ error: 'webhook not configured' }, 503);
    }

    // Read the raw body BEFORE parsing — HMAC must run on the exact bytes.
    const rawBody = await req.text();
    const sigHeader = req.headers.get('x-meetingbot-signature')
      || req.headers.get('x-signature')
      || req.headers.get('webhook-signature');
    const ok = await verifyHmac(rawBody, sigHeader, secret);
    if (!ok) {
      // Don't leak whether the signature header was present vs. invalid.
      return json({ error: 'unauthorized' }, 401);
    }

    let payload: Record<string, unknown>;
    try { payload = JSON.parse(rawBody); }
    catch { return json({ error: 'invalid json' }, 400); }

    const event = String(payload?.event || '').toLowerCase();
    const data = payload?.data || {};
    const externalBotId: string | undefined = data?.bot_id || data?.id || payload?.bot_id;
    const localId: string | undefined = data?.metadata?.local_meeting_bot_id
      || payload?.metadata?.local_meeting_bot_id;

    if (!externalBotId && !localId) {
      return json({ error: 'no bot identifier in payload' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find the local row. external_bot_id is the primary key into our
    // mapping; localId is a fallback for the very first delivery if
    // external_bot_id wasn't yet stored when the webhook fires.
    let row: Record<string, unknown> | null = null;
    if (externalBotId) {
      const { data: byExt } = await admin
        .from('meeting_bots')
        .select('*')
        .eq('external_bot_id', externalBotId)
        .maybeSingle();
      row = byExt;
    }
    if (!row && localId) {
      const { data: byLocal } = await admin
        .from('meeting_bots')
        .select('*')
        .eq('id', localId)
        .maybeSingle();
      row = byLocal;
    }
    if (!row) {
      // Idempotent: ack the webhook so MeetingBot doesn't retry forever
      // even if the row got deleted on our side.
      console.warn('[meeting-bot-webhook] no matching row', { externalBotId, localId, event });
      return json({ ok: true, skipped: 'no matching row' });
    }

    // Build the patch from whatever fields are present.
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const evStatus = mapEventToStatus(event);
    if (evStatus) patch.status = evStatus;
    else if (data?.status) patch.status = normaliseStatus(data.status);

    if (Array.isArray(data?.transcript)) {
      patch.transcript = sanitiseTranscript(data.transcript);
    }
    const analysis: BotAnalysis | undefined = data?.analysis;
    if (analysis && typeof analysis === 'object') {
      if (typeof analysis.summary === 'string') patch.summary = analysis.summary.slice(0, 8000);
      if (Array.isArray(analysis.key_points)) patch.key_points = analysis.key_points.slice(0, 50);
      if (Array.isArray(analysis.action_items)) patch.action_items = analysis.action_items.slice(0, 50);
      if (Array.isArray(analysis.decisions)) patch.decisions = analysis.decisions.slice(0, 50);
      if (Array.isArray(analysis.next_steps)) patch.next_steps = analysis.next_steps.slice(0, 50);
      if (Array.isArray(analysis.topics)) patch.topics = analysis.topics.slice(0, 50);
      if (typeof analysis.sentiment === 'string') patch.sentiment = analysis.sentiment.slice(0, 80);
    }
    if (typeof data?.error === 'string') patch.error_message = data.error.slice(0, 2000);
    if (typeof data?.joined_at === 'string') patch.joined_at = data.joined_at;
    if (typeof data?.ended_at === 'string') patch.ended_at = data.ended_at;
    if (!row.external_bot_id && externalBotId) patch.external_bot_id = externalBotId;

    // Append the raw payload to metadata.events for an audit trail
    // without overwriting prior events. Cap the array at 20 entries.
    const events = Array.isArray((row.metadata as Record<string, unknown>)?.events) ? (row.metadata as Record<string, unknown>).events as Record<string, unknown>[] : [];
    events.push({ event, at: new Date().toISOString() });
    patch.metadata = {
      ...((row.metadata as Record<string, unknown>) ?? {}),
      events: events.slice(-20),
    };

    await admin.from('meeting_bots').update(patch).eq('id', row.id);

    // Auto-create tasks from action_items on bot.done. Idempotent via
    // the tasks_created_at sentinel.
    if (event === 'bot.done' && Array.isArray((patch.action_items as unknown))) {
      if (!row.tasks_created_at) {
        const items = patch.action_items as Array<{ task: string; assignee?: string }>;
        const inserts = items
          .map((it) => (typeof it?.task === 'string' && it.task.trim().length > 0)
            ? {
              user_id: row.user_id,
              workspace_id: row.workspace_id,
              title: it.task.trim().slice(0, 200),
              description: row.title ? `From meeting: ${row.title}` : 'From meeting recap',
              category: 'business',
              priority: 'medium',
              source: 'meeting_bot',
              source_ref: row.id,
              completed: false,
              trashed: false,
            }
            : null)
          .filter(Boolean) as Record<string, unknown>[];
        if (inserts.length > 0) {
          const { error: tErr, count } = await admin
            .from('tasks')
            .insert(inserts, { count: 'exact' });
          if (!tErr) {
            await admin.from('meeting_bots').update({
              tasks_created_at: new Date().toISOString(),
              tasks_created_count: count ?? inserts.length,
            }).eq('id', row.id);
          } else {
            console.warn('[meeting-bot-webhook] task insert failed', tErr.message);
          }
        }
      }
    }

    return json({ ok: true, event, status: patch.status ?? null });
  } catch (err) {
    console.error('[meeting-bot-webhook] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

// Maps MeetingBot's event names to our status enum where the mapping
// is unambiguous. Returns null when status should be taken from
// data.status instead (e.g. live transcript fragments).
function mapEventToStatus(event: string): string | null {
  switch (event) {
    case 'bot.joining':           return 'joining';
    case 'bot.in_call':           return 'in_call';
    case 'bot.call_ended':        return 'call_ended';
    case 'bot.transcript_ready':  return 'transcript_ready';
    case 'bot.analysis_ready':    return 'analysis_ready';
    case 'bot.done':              return 'done';
    case 'bot.error':             return 'error';
    case 'bot.cancelled':         return 'cancelled';
    default:                      return null;
  }
}

function sanitiseTranscript(arr: unknown[]): TranscriptEntry[] {
  return arr.slice(0, 5000).map((e) => {
    const entry = e as Record<string, unknown>;
    return {
      speaker: typeof entry?.speaker === 'string' ? (entry.speaker as string).slice(0, 120) : 'Unknown',
      text: typeof entry?.text === 'string' ? (entry.text as string).slice(0, 4000) : '',
      timestamp: typeof entry?.timestamp === 'number' ? entry.timestamp as number : 0,
      source: entry?.source === 'chat' ? 'chat' : 'voice',
      message_id: typeof entry?.message_id === 'string' ? entry.message_id as string : undefined,
      bot_generated: !!entry?.bot_generated,
    };
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
