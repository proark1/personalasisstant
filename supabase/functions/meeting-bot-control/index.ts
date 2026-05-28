// Meeting bot control plane.
//
// One endpoint, two actions:
//   - cancel: DELETE upstream + mark our row 'cancelled'
//   - refresh: GET upstream and patch our row (manual reconcile when
//              a webhook delivery was missed)
//
// Auth: end-user JWT only — no service-role passthrough; the webhook
// is the service-role surface.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
import { strictAppOrigin } from '../_shared/cors.ts';
  deleteBot,
  getBot,
  loadConfig,
  normaliseStatus,
  type BotAnalysis,
} from '../_shared/meetingbot.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return json({ error: 'invalid id' }, 400);
    if (!['cancel', 'refresh'].includes(action)) return json({ error: 'invalid action' }, 400);

    const { data: row, error: rErr } = await admin
      .from('meeting_bots')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (rErr || !row) return json({ error: 'not found' }, 404);

    let cfg;
    try { cfg = loadConfig(); }
    catch (e) { return json({ error: 'MeetingBot not configured', details: (e as Error).message }, 503); }

    if (action === 'cancel') {
      if (row.external_bot_id) {
        try { await deleteBot(cfg, user.id, row.external_bot_id); }
        catch (e) {
          // Even if upstream delete failed, mark cancelled locally so
          // the user isn't blocked. Log the failure for ops.
          console.warn('[meeting-bot-control] upstream delete failed', (e as Error).message);
        }
      }
      await admin.from('meeting_bots').update({
        status: 'cancelled',
        ended_at: new Date().toISOString(),
      }).eq('id', id);
      return json({ ok: true, action: 'cancelled' });
    }

    // refresh
    if (!row.external_bot_id) {
      return json({ error: 'no external bot id; nothing to refresh' }, 400);
    }
    try {
      const upstream = await getBot(cfg, user.id, row.external_bot_id);
      const patch: Record<string, unknown> = {
        status: normaliseStatus(upstream.status) || row.status,
        updated_at: new Date().toISOString(),
      };
      if (Array.isArray(upstream.transcript)) patch.transcript = upstream.transcript;
      const analysis: BotAnalysis | null | undefined = upstream.analysis;
      if (analysis && typeof analysis === 'object') {
        if (typeof analysis.summary === 'string') patch.summary = analysis.summary.slice(0, 8000);
        if (Array.isArray(analysis.key_points)) patch.key_points = analysis.key_points.slice(0, 50);
        if (Array.isArray(analysis.action_items)) patch.action_items = analysis.action_items.slice(0, 50);
        if (Array.isArray(analysis.decisions)) patch.decisions = analysis.decisions.slice(0, 50);
        if (Array.isArray(analysis.next_steps)) patch.next_steps = analysis.next_steps.slice(0, 50);
        if (Array.isArray(analysis.topics)) patch.topics = analysis.topics.slice(0, 50);
        if (typeof analysis.sentiment === 'string') patch.sentiment = analysis.sentiment.slice(0, 80);
      }
      if (typeof upstream.error === 'string') patch.error_message = upstream.error.slice(0, 2000);
      if (typeof upstream.joined_at === 'string') patch.joined_at = upstream.joined_at;
      if (typeof upstream.ended_at === 'string') patch.ended_at = upstream.ended_at;
      await admin.from('meeting_bots').update(patch).eq('id', id);
      return json({ ok: true, action: 'refreshed', status: patch.status });
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
  } catch (err) {
    console.error('[meeting-bot-control] failed', (err as Error).message);
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
