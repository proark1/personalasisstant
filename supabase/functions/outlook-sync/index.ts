import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function refreshOutlookToken(refreshToken: string) {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
  const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'offline_access User.Read Calendars.ReadWrite',
    }),
  });
  if (!resp.ok) {
    console.error('Outlook refresh failed:', await resp.text());
    return null;
  }
  return resp.json();
}

function toGraphEvent(localEvent: any) {
  return {
    subject: localEvent.title || 'Untitled',
    body: { contentType: 'Text', content: localEvent.description || '' },
    start: { dateTime: new Date(localEvent.start_time).toISOString(), timeZone: 'UTC' },
    end: { dateTime: new Date(localEvent.end_time).toISOString(), timeZone: 'UTC' },
    location: localEvent.location ? { displayName: localEvent.location } : undefined,
  };
}

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

    const { data: connection, error: connErr } = await admin
      .from('external_calendar_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .eq('provider', 'outlook')
      .single();
    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date(Date.now() + 60_000)) {
      const newTokens = await refreshOutlookToken(connection.refresh_token);
      if (!newTokens) {
        await admin.from('external_calendar_connections').update({ last_sync_error: 'token_refresh_failed' }).eq('id', connectionId);
        return new Response(JSON.stringify({ error: 'Failed to refresh Outlook token. Please reconnect.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      accessToken = newTokens.access_token;
      await admin.from('external_calendar_connections').update({
        access_token: accessToken,
        refresh_token: newTokens.refresh_token || connection.refresh_token,
        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq('id', connectionId);
    }

    const calendarId = connection.external_calendar_id || 'primary';
    const calPath = calendarId === 'primary' ? '/me/calendar' : `/me/calendars/${calendarId}`;

    // ====== PULL: fetch events in window ======
    const now = new Date();
    const startWin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endWin = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

    const eventsUrl = `${GRAPH}${calPath}/calendarView?startDateTime=${startWin}&endDateTime=${endWin}&$top=250&$select=id,subject,body,start,end,location,attendees,isCancelled,changeKey`;
    const evResp = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!evResp.ok) {
      const errText = await evResp.text();
      console.error('Outlook events fetch failed:', errText);
      await admin.from('external_calendar_connections').update({ last_sync_error: errText.slice(0, 500) }).eq('id', connectionId);
      return new Response(JSON.stringify({ error: 'Failed to fetch Outlook events' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const evData = await evResp.json();
    const remote = evData.value || [];

    let imported = 0, updated = 0, pushed = 0, deleted = 0;
    const errors: string[] = [];

    for (const ev of remote) {
      try {
        if (ev.isCancelled) {
          await admin.from('events').delete()
            .eq('user_id', user.id).eq('external_source', 'outlook').eq('external_id', ev.id);
          deleted++;
          continue;
        }
        const startTime = ev.start?.dateTime ? `${ev.start.dateTime}Z` : null;
        const endTime = ev.end?.dateTime ? `${ev.end.dateTime}Z` : null;
        if (!startTime || !endTime) continue;

        const eventData = {
          user_id: user.id,
          title: ev.subject || 'Untitled Event',
          description: ev.body?.content || null,
          start_time: startTime,
          end_time: endTime,
          location: ev.location?.displayName || null,
          external_source: 'outlook',
          external_id: ev.id,
          external_etag: ev.changeKey || null,
          connection_id: connectionId,
          sync_status: 'synced',
          attendees: ev.attendees?.map((a: any) => a.emailAddress?.address).filter(Boolean) || null,
        };

        const { data: existing } = await admin.from('events').select('id, external_etag')
          .eq('user_id', user.id).eq('external_source', 'outlook').eq('external_id', ev.id).maybeSingle();

        if (existing) {
          if (existing.external_etag !== ev.changeKey) {
            await admin.from('events').update(eventData).eq('id', existing.id);
            updated++;
          }
        } else {
          await admin.from('events').insert(eventData);
          imported++;
        }
      } catch (e: any) {
        errors.push(`pull: ${e?.message || 'unknown'}`);
      }
    }

    // ====== PUSH: any local events with sync_status=pending_push and connection_id=this ======
    if (connection.sync_direction === 'two_way') {
      // Push events that the user wants tied to this Outlook calendar
      const { data: pendingEvents } = await admin.from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('connection_id', connectionId)
        .eq('sync_status', 'pending_push')
        .limit(50);

      for (const local of pendingEvents || []) {
        try {
          if (local.external_id) {
            // Update existing remote event
            const resp = await fetch(`${GRAPH}/me/events/${local.external_id}`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(toGraphEvent(local)),
            });
            if (resp.ok) {
              const updated = await resp.json();
              await admin.from('events').update({
                sync_status: 'synced',
                external_etag: updated.changeKey,
                last_pushed_at: new Date().toISOString(),
              }).eq('id', local.id);
              pushed++;
            } else {
              errors.push(`push update: ${resp.status}`);
            }
          } else {
            // Create new remote event
            const resp = await fetch(`${GRAPH}${calPath}/events`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(toGraphEvent(local)),
            });
            if (resp.ok) {
              const created = await resp.json();
              await admin.from('events').update({
                external_id: created.id,
                external_source: 'outlook',
                external_etag: created.changeKey,
                sync_status: 'synced',
                last_pushed_at: new Date().toISOString(),
              }).eq('id', local.id);
              pushed++;
            } else {
              errors.push(`push create: ${resp.status}`);
            }
          }
        } catch (e: any) {
          errors.push(`push: ${e?.message || 'unknown'}`);
        }
      }
    }

    await admin.from('external_calendar_connections').update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: errors.length ? errors.slice(0, 5).join('; ') : null,
    }).eq('id', connectionId);

    return new Response(JSON.stringify({
      success: true, imported, updated, pushed, deleted,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('outlook-sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
