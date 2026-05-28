import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

// Apple iCloud CalDAV well-known endpoint
const APPLE_CALDAV_BASE = 'https://caldav.icloud.com';

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

    const { appleId, appPassword, calendarName } = await req.json();
    if (!appleId || !appPassword) {
      return new Response(JSON.stringify({ error: 'Apple ID and app-specific password are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate credentials by issuing a PROPFIND
    const auth = btoa(`${appleId}:${appPassword}`);
    const propfind = await fetch(`${APPLE_CALDAV_BASE}/`, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${auth}`,
        Depth: '0',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
    });

    if (propfind.status === 401 || propfind.status === 403) {
      return new Response(JSON.stringify({
        error: 'Invalid Apple ID or app-specific password. Generate a new one at appleid.apple.com.',
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!propfind.ok && propfind.status !== 207) {
      const text = await propfind.text();
      console.error('Apple CalDAV PROPFIND failed:', propfind.status, text);
      return new Response(JSON.stringify({ error: `iCloud rejected the connection (${propfind.status}).` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse principal URL from response
    const respText = await propfind.text();
    const principalMatch = respText.match(/<href[^>]*>([^<]*\/principal\/[^<]*)<\/href>/i);
    const principalPath = principalMatch?.[1] || `/${appleId}/principal/`;

    // Discover calendar home
    const homeFind = await fetch(`${APPLE_CALDAV_BASE}${principalPath}`, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${auth}`,
        Depth: '0',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
    });
    const homeText = await homeFind.text();
    const homeMatch = homeText.match(/<href[^>]*>([^<]*\/calendars\/[^<]*)<\/href>/i);
    const calendarHome = homeMatch?.[1] || `/${appleId}/calendars/`;

    // We use the home + 'home/' subpath as the default principal calendar
    const caldavUrl = `${APPLE_CALDAV_BASE}${calendarHome}home/`;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await admin.from('external_calendar_connections')
      .select('id').eq('user_id', user.id).eq('provider', 'apple').eq('caldav_username', appleId).maybeSingle();

    const payload = {
      user_id: user.id,
      provider: 'apple',
      auth_type: 'caldav',
      name: calendarName || `iCloud (${appleId})`,
      color: '#A6A6A6',
      external_calendar_id: caldavUrl,
      caldav_url: caldavUrl,
      caldav_username: appleId,
      caldav_password_encrypted: appPassword, // Stored as-is; service role + RLS protects access
      sync_enabled: true,
      sync_direction: 'two_way',
      last_sync_error: null,
    };

    if (existing) {
      await admin.from('external_calendar_connections').update(payload).eq('id', existing.id);
    } else {
      await admin.from('external_calendar_connections').insert(payload);
    }

    return new Response(JSON.stringify({ success: true, caldavUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('apple-caldav-connect error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
