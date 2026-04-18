// Scheduled Gmail sync — triggered once per day (24h) via pg_cron.
// On-demand refresh (max once per 2h) is handled in the chat function when the user asks about emails.
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

    const { data: connections, error } = await admin
      .from('external_calendar_connections')
      .select('user_id')
      .eq('provider', 'google')
      .eq('sync_enabled', true);

    if (error) throw error;

    const uniqueUserIds = Array.from(new Set((connections || []).map(c => c.user_id)));
    console.log(`[gmail-sync-cron] Syncing ${uniqueUserIds.length} users`);

    const results: { userId: string; status: string; newEmails?: number; error?: string }[] = [];

    for (const userId of uniqueUserIds) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
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
          results.push({ userId, status: 'ok', newEmails: json?.newEmails || 0 });
        }
      } catch (e) {
        console.error(`[gmail-sync-cron] User ${userId} failed:`, e);
        results.push({ userId, status: 'error', error: String(e) });
      }

      // Tiny delay to be polite to Gmail/AI APIs
      await new Promise(r => setTimeout(r, 500));
    }

    const okCount = results.filter(r => r.status === 'ok').length;
    const totalNew = results.reduce((sum, r) => sum + (r.newEmails || 0), 0);
    console.log(`[gmail-sync-cron] Done: ${okCount}/${uniqueUserIds.length} synced, ${totalNew} new emails`);

    return new Response(JSON.stringify({ total: uniqueUserIds.length, ok: okCount, totalNew, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[gmail-sync-cron] Fatal:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
