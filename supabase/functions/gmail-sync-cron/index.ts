// Scheduled Gmail sync — runs every 2 hours via pg_cron.
// Iterates over all users with a Google connection and triggers gmail-sync per user.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with a google connection + sync enabled
    const { data: connections, error } = await admin
      .from('external_calendar_connections')
      .select('user_id')
      .eq('provider', 'google')
      .eq('sync_enabled', true);

    if (error) throw error;

    const uniqueUserIds = Array.from(new Set((connections || []).map(c => c.user_id)));
    console.log(`[gmail-sync-cron] Syncing ${uniqueUserIds.length} users`);

    const results: { userId: string; status: string; error?: string }[] = [];

    // Process sequentially to avoid overwhelming Gmail API and AI rate limits
    for (const userId of uniqueUserIds) {
      try {
        // Mint a service-role JWT impersonation by calling gmail-sync with service role key
        // gmail-sync expects user JWT — instead we replicate its logic here would be huge,
        // so we invoke it with a forged user context via x-user-id header is not supported.
        // Simpler: call the function with service role key — but function uses getClaims which
        // requires a user token. So we use admin.auth.admin to generate a session... not allowed.
        // Best path: invoke gmail-sync via fetch using service role + a custom internal header.
        const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-sync-internal`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'x-internal-user-id': userId,
          },
          body: JSON.stringify({ maxResults: 30 }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          results.push({ userId, status: 'error', error: json?.message || `HTTP ${resp.status}` });
        } else {
          results.push({ userId, status: 'ok' });
        }
      } catch (e) {
        console.error(`[gmail-sync-cron] User ${userId} failed:`, e);
        results.push({ userId, status: 'error', error: String(e) });
      }
    }

    return new Response(JSON.stringify({ total: uniqueUserIds.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[gmail-sync-cron] Fatal:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
