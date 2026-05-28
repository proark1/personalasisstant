import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

// Build a minimal iCalendar VEVENT
function toICS(local: any): string {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = local.external_id || `${local.id}@darai`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DarAI//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(local.start_time)}`,
    `DTEND:${fmt(local.end_time)}`,
    `SUMMARY:${(local.title || 'Untitled').replace(/\n/g, ' ')}`,
    local.description ? `DESCRIPTION:${local.description.replace(/\n/g, '\\n')}` : '',
    local.location ? `LOCATION:${local.location.replace(/\n/g, ' ')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// Parse iCalendar VEVENT blocks (basic, sufficient for typical iCloud output)
function parseICSEvents(ics: string): any[] {
  const events: any[] = [];
  const blocks = ics.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    const get = (k: string) => {
      const m = body.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.+)$`, 'm'));
      return m?.[1]?.trim();
    };
    const dt = (s?: string) => {
      if (!s) return null;
      // Handle YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS or YYYYMMDD
      const m = s.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
      if (!m) return null;
      const [_, Y, M, D, h = '00', mn = '00', sc = '00', Z] = m;
      return `${Y}-${M}-${D}T${h}:${mn}:${sc}${Z ? 'Z' : 'Z'}`;
    };
    events.push({
      uid: get('UID'),
      summary: get('SUMMARY'),
      description: get('DESCRIPTION')?.replace(/\\n/g, '\n'),
      location: get('LOCATION'),
      dtstart: dt(get('DTSTART')),
      dtend: dt(get('DTEND')),
      etag: null,
    });
  }
  return events;
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

    const { data: connection, error: cErr } = await admin.from('external_calendar_connections')
      .select('*').eq('id', connectionId).eq('user_id', user.id).eq('provider', 'apple').single();
    if (cErr || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = btoa(`${connection.caldav_username}:${connection.caldav_password_encrypted}`);
    const baseUrl = connection.caldav_url;

    // Time-range query against the calendar collection
    const now = new Date();
    const startWin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const endWin = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const reportBody = `<?xml version="1.0"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${startWin}" end="${endWin}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;

    const reportResp = await fetch(baseUrl, {
      method: 'REPORT',
      headers: {
        Authorization: `Basic ${auth}`,
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: reportBody,
    });

    if (!reportResp.ok && reportResp.status !== 207) {
      const errText = await reportResp.text();
      console.error('Apple CalDAV REPORT failed:', reportResp.status, errText.slice(0, 300));
      await admin.from('external_calendar_connections').update({ last_sync_error: `report ${reportResp.status}` }).eq('id', connectionId);
      return new Response(JSON.stringify({ error: 'Failed to fetch iCloud events' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xml = await reportResp.text();
    // Naive multi-status parse: find each calendar-data block
    const dataBlocks = [...xml.matchAll(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/gi)].map(m => m[1].trim());
    const hrefBlocks = [...xml.matchAll(/<href[^>]*>([^<]+\.ics)<\/href>/gi)].map(m => m[1]);

    let imported = 0, updated = 0, pushed = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataBlocks.length; i++) {
      try {
        const events = parseICSEvents(dataBlocks[i]);
        for (const ev of events) {
          if (!ev.dtstart || !ev.dtend || !ev.uid) continue;
          const eventData = {
            user_id: user.id,
            title: ev.summary || 'Untitled',
            description: ev.description || null,
            start_time: ev.dtstart,
            end_time: ev.dtend,
            location: ev.location || null,
            external_source: 'apple',
            external_id: ev.uid,
            connection_id: connectionId,
            sync_status: 'synced',
          };
          const { data: existing } = await admin.from('events').select('id')
            .eq('user_id', user.id).eq('external_source', 'apple').eq('external_id', ev.uid).maybeSingle();
          if (existing) {
            await admin.from('events').update(eventData).eq('id', existing.id);
            updated++;
          } else {
            await admin.from('events').insert(eventData);
            imported++;
          }
        }
      } catch (e: any) {
        errors.push(`pull: ${e?.message || 'unknown'}`);
      }
    }

    // ====== PUSH local pending_push events ======
    if (connection.sync_direction === 'two_way') {
      const { data: pendingEvents } = await admin.from('events')
        .select('*').eq('user_id', user.id).eq('connection_id', connectionId).eq('sync_status', 'pending_push').limit(50);
      for (const local of pendingEvents || []) {
        try {
          const uid = local.external_id || `${local.id}@darai`;
          const ics = toICS({ ...local, external_id: uid });
          const url = `${baseUrl}${uid}.ics`;
          const putResp = await fetch(url, {
            method: 'PUT',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'text/calendar; charset=utf-8',
            },
            body: ics,
          });
          if (putResp.ok || putResp.status === 201 || putResp.status === 204) {
            await admin.from('events').update({
              external_id: uid,
              external_source: 'apple',
              sync_status: 'synced',
              last_pushed_at: new Date().toISOString(),
            }).eq('id', local.id);
            pushed++;
          } else {
            errors.push(`push: ${putResp.status}`);
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
      success: true, imported, updated, pushed,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('apple-caldav-sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
