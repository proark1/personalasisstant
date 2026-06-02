// calendar-sync-all — periodic bidirectional sync of every enabled calendar.
//
// Invoked by pg_cron (service-role bearer) on a schedule. Iterates all
// sync-enabled Google/Apple connections and runs the same pull/push core the
// manual "Sync" button uses, so locally-created events mirror out and provider
// events pull in without the user pressing anything.
//
// Auth: requires the service-role bearer (cron). It is NOT a user-facing
// endpoint.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';
import { syncConnection, type CalendarConnection } from '../_shared/calendar-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Sync at most this many connections per invocation to stay within the function
// time budget; the schedule runs often enough to cover the rest.
const MAX_CONNECTIONS = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Only the cron (service-role bearer) may trigger a full sync.
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: connections, error } = await admin
    .from('external_calendar_connections')
    .select('*')
    .eq('sync_enabled', true)
    .in('provider', ['google', 'apple'])
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(MAX_CONNECTIONS);

  if (error) {
    console.error('calendar-sync-all: failed to load connections:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const totals = { imported: 0, updated: 0, pushed: 0, errors: 0, connections: 0 };

  for (const conn of (connections || []) as CalendarConnection[]) {
    try {
      const r = await syncConnection(admin, conn);
      totals.imported += r.imported;
      totals.updated += r.updated;
      totals.pushed += r.pushed;
      totals.errors += r.errors.length;
      totals.connections++;
    } catch (e) {
      console.error(`calendar-sync-all: connection ${conn.id} failed:`, e instanceof Error ? e.message : e);
      totals.errors++;
    }
  }

  console.log(`calendar-sync-all: ${totals.connections} connections, ${totals.imported} imported, ${totals.updated} updated, ${totals.pushed} pushed, ${totals.errors} errors`);

  return new Response(JSON.stringify({ success: true, ...totals }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
