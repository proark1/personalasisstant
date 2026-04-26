// Hourly Plaid sync.
//
// pg_cron pings this fn every hour. We walk every bank_connections
// row that is healthy enough to sync (status in good|reauth_required)
// and invoke /plaid-sync for each, on behalf of the owning user via
// the service-role + x-telegram-user-id pattern.
//
// Errors per-user are isolated — one bad token doesn't stop the rest.
// Auth: requires service-role bearer (matches existing cron pattern).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cap how many users we sync per invocation — the sync edge fn is
// already capped at 5 pages per call, but we still don't want a
// single cron run blocking on hundreds of users.
const USERS_PER_RUN = 50;

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

    // Pull the distinct user_ids with at least one syncable connection.
    // Sort by last_synced_at ASC so the oldest get fresh data first.
    const { data: rows, error } = await admin
      .from('bank_connections')
      .select('user_id, last_synced_at')
      .in('status', ['good', 'reauth_required'])
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(USERS_PER_RUN * 5); // overfetch then dedupe to N users
    if (error) return json({ error: error.message }, 500);

    const seen = new Set<string>();
    const userIds: string[] = [];
    for (const r of (rows ?? []) as Array<{ user_id: string }>) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      userIds.push(r.user_id);
      if (userIds.length >= USERS_PER_RUN) break;
    }

    if (userIds.length === 0) return json({ ok: true, synced: 0 });

    let synced = 0;
    const errors: Array<{ user_id: string; err: string }> = [];
    for (const userId of userIds) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/plaid-sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'x-telegram-user-id': userId,
          },
          body: '{}',
          signal: AbortSignal.timeout(55_000),
        });
        if (!r.ok) {
          errors.push({ user_id: userId, err: `HTTP ${r.status}` });
        } else {
          synced += 1;
        }
      } catch (e) {
        errors.push({ user_id: userId, err: (e as Error).message });
      }
    }

    return json({
      ok: true,
      candidate_users: userIds.length,
      synced,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[plaid-sync-cron] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
