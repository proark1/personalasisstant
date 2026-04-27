// Schedule a MeetingBot to join a meeting.
//
// Two-phase write so a crashed call doesn't leave us out of sync with
// the upstream service:
//   1. Insert a local row with status='pending' and our own UUID. We
//      pass that UUID as `sub_user_id` metadata so the upstream side
//      and the eventual webhook can correlate back to us.
//   2. POST to MeetingBot's /api/v1/bot. On success, patch our row
//      with the external bot id + status='scheduled' (or whatever
//      MeetingBot returned). On failure, mark status='error' and
//      surface the upstream message.
//
// Body shape:
//   { meeting_url, title?, bot_name?, join_at?, event_id?, workspace_id?,
//     record_video?, vocabulary?, metadata? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createBot,
  loadConfig,
  normaliseStatus,
  type CreateBotRequest,
} from '../_shared/meetingbot.ts';
import { recordUndo } from '../_shared/dori-undo.ts';
import { adminClient, resolveUserId } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const user = { id: auth.userId };
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = adminClient();

    const body = await req.json().catch(() => ({}));
    const meetingUrl = String(body.meeting_url || '').trim();
    if (!meetingUrl || !/^https?:\/\//i.test(meetingUrl)) {
      return json({ error: 'meeting_url is required and must be http(s)' }, 400);
    }
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : null;
    const botName = (typeof body.bot_name === 'string' ? body.bot_name : 'Notetaker').slice(0, 80);
    const joinAt = typeof body.join_at === 'string' ? body.join_at : null;
    const eventId = typeof body.event_id === 'string' ? body.event_id : null;
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : null;
    const recordVideo = !!body.record_video;
    const vocabulary = Array.isArray(body.vocabulary)
      ? body.vocabulary.filter((s: unknown) => typeof s === 'string').slice(0, 100)
      : [];

    // Phase 1: persist the row locally.
    const { data: row, error: insErr } = await admin
      .from('meeting_bots')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        event_id: eventId,
        meeting_url: meetingUrl,
        title,
        bot_name: botName,
        join_at: joinAt,
        status: 'pending',
        metadata: {
          requested_record_video: recordVideo,
          requested_vocabulary: vocabulary,
          ...((body.metadata && typeof body.metadata === 'object') ? body.metadata : {}),
        },
      })
      .select('id')
      .single();
    if (insErr || !row) return json({ error: insErr?.message || 'insert failed' }, 500);

    // Phase 2: ask MeetingBot to do the actual join.
    let cfg;
    try {
      cfg = loadConfig();
    } catch (e) {
      await admin.from('meeting_bots').update({
        status: 'error',
        error_message: (e as Error).message,
      }).eq('id', row.id);
      return json({
        error: 'MeetingBot is not configured',
        details: (e as Error).message,
        local_row: row.id,
      }, 503);
    }

    // Build the webhook URL from the public Supabase functions URL —
    // MeetingBot will POST terminal-state events here. The webhook
    // endpoint is intentionally JWT-less and HMAC-verified.
    const webhookUrl = `${supabaseUrl}/functions/v1/meeting-bot-webhook`;

    const reqBody: CreateBotRequest = {
      meeting_url: meetingUrl,
      bot_name: botName,
      webhook_url: webhookUrl,
      join_at: joinAt ?? undefined,
      record_video: recordVideo,
      vocabulary,
      metadata: {
        ...((body.metadata && typeof body.metadata === 'object') ? body.metadata : {}),
        // Round-trips with every webhook so we can find this row even
        // if external_bot_id is somehow null on first delivery.
        local_meeting_bot_id: row.id,
        local_user_id: user.id,
      },
      sub_user_id: user.id,
    };

    try {
      const upstream = await createBot(cfg, user.id, reqBody);
      const status = normaliseStatus(upstream.status) || 'scheduled';
      await admin.from('meeting_bots').update({
        external_bot_id: upstream.id,
        status,
        metadata: {
          ...((upstream.metadata && typeof upstream.metadata === 'object') ? upstream.metadata : {}),
          local_meeting_bot_id: row.id,
          local_user_id: user.id,
        },
      }).eq('id', row.id);
      // Record undo so the user can revert within the 5-minute window.
      // Snapshot deletes the local row; the upstream bot keeps running
      // until the user explicitly cancels (idempotent — they can use
      // the cancel control later if undo timing missed).
      const undoId = await recordUndo(admin, {
        user_id: user.id,
        op: 'create',
        entity_type: 'meeting_bot',
        entity_id: row.id,
        label: title || meetingUrl,
        inverse_tool_xml: null,
        snapshot: { kind: 'delete_by_id', table: 'meeting_bots', id: row.id },
        source: 'meeting_bot',
        source_ref: row.id,
      });

      return json({
        ok: true,
        id: row.id,
        external_bot_id: upstream.id,
        status,
        undo_id: undoId,
      });
    } catch (e) {
      await admin.from('meeting_bots').update({
        status: 'error',
        error_message: (e as Error).message.slice(0, 1000),
      }).eq('id', row.id);
      return json({
        error: (e as Error).message,
        local_row: row.id,
      }, 502);
    }
  } catch (err) {
    console.error('[meeting-bot-schedule] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

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
