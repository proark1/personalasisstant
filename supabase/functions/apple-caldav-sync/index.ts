import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';
import { syncAppleConnection } from '../_shared/calendar-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { connectionId } = await req.json();
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: connection, error: cErr } = await admin.from('external_calendar_connections')
      .select('*').eq('id', connectionId).eq('user_id', user.id).eq('provider', 'apple').single();
    if (cErr || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await syncAppleConnection(admin, connection);
    console.log(`Apple sync complete: ${result.imported} imported, ${result.updated} updated, ${result.pushed} pushed, ${result.errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      imported: result.imported,
      updated: result.updated,
      pushed: result.pushed,
      errors: result.errors.length ? result.errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('apple-caldav-sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
