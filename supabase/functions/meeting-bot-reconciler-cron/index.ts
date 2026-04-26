// Meeting-bot reconciler.
//
// pg_cron pings every 30 minutes. We scan meeting_bots rows that are
// "in flight" (not in a terminal status) and whose updated_at is
// older than the threshold — those are likely missing webhook
// deliveries — and call /meeting-bot-control with action='refresh'
// for each, which triggers a GET against MeetingBot's API.
//
// This catches:
//   - bots that joined but never returned (webhook delivery dropped)
//   - bots that finished but the webhook missed our endpoint
//   - dead bots upstream that should be marked errored locally
//
// Auth: service-role bearer.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// "Stale" threshold: a bot that hasn't been updated in this long is a
// reconciler candidate.
const STALE_MINUTES = 25;

const ACTIVE_STATUSES = [
  'pending', 'scheduled', 'joining', 'in_call',
  'call_ended', 'transcript_ready', 'analysis_ready',
];

const PER_RUN_LIMIT = 40;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceKey || authHeader.replace(/^Bearer\s+/i, '') !== serviceKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
    const { data: stale, error } = await admin
      .from('meeting_bots')
      .select('id, user_id, external_bot_id, status, updated_at, title')
      .in('status', ACTIVE_STATUSES)
      .lt('updated_at', cutoff)
      .not('external_bot_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(PER_RUN_LIMIT);
    if (error) return json({ error: error.message }, 500);

    let refreshed = 0;
    const errors: Array<{ id: string; err: string }> = [];
    for (const bot of (stale ?? []) as Array<{ id: string; user_id: string }>) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/meeting-bot-control`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'x-telegram-user-id': bot.user_id,
          },
          body: JSON.stringify({ id: bot.id, action: 'refresh' }),
          signal: AbortSignal.timeout(40_000),
        });
        if (r.ok) refreshed += 1;
        else errors.push({ id: bot.id, err: `HTTP ${r.status}` });
      } catch (e) {
        errors.push({ id: bot.id, err: (e as Error).message });
      }
    }

    return json({
      ok: true,
      candidate_count: (stale ?? []).length,
      refreshed,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[meeting-bot-reconciler-cron] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
