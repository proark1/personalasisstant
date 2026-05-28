// Daily trip-prep dispatcher.
//
// pg_cron pings once a day. We find trips that:
//   - haven't been prepped yet (prep_run_at IS NULL)
//   - start within the next 7 days (so weather is available)
//   - aren't already past
// and call /trip-prep for each. The trip-prep fn is idempotent via
// the prep_run_at sentinel, so duplicates are safe.
//
// Auth: service-role bearer.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PER_RUN_LIMIT = 30;
// Sweet-spot horizon: the weather-forecast fn caches 14 days; we
// trigger 7 days out so the AI packing list has the most reliable
// forecast band to plan against.
const HORIZON_DAYS = 7;

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

    const today = new Date().toISOString().slice(0, 10);
    const horizon = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + HORIZON_DAYS);
      return d.toISOString().slice(0, 10);
    })();

    const { data: trips, error } = await admin
      .from('trips')
      .select('id, user_id, title, destination, start_date')
      .is('prep_run_at', null)
      .gte('start_date', today)
      .lte('start_date', horizon)
      .order('start_date', { ascending: true })
      .limit(PER_RUN_LIMIT);
    if (error) return json({ error: error.message }, 500);

    let prepped = 0;
    const errors: Array<{ id: string; err: string }> = [];
    for (const trip of (trips ?? []) as Array<{ id: string; user_id: string }>) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/trip-prep`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'x-telegram-user-id': trip.user_id,
          },
          body: JSON.stringify({ trip_id: trip.id, force: false }),
          signal: AbortSignal.timeout(55_000),
        });
        if (r.ok) prepped += 1;
        else errors.push({ id: trip.id, err: `HTTP ${r.status}` });
      } catch (e) {
        errors.push({ id: trip.id, err: (e as Error).message });
      }
    }

    return json({
      ok: true,
      candidate_count: (trips ?? []).length,
      prepped,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[trip-prep-cron] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
