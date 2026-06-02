// Shared bidirectional calendar sync for Google and Apple (CalDAV).
//
// Both the user-triggered per-connection functions (calendar-sync,
// apple-caldav-sync) and the cron "sync all" function call into here, so the
// pull/push behaviour is identical whether a sync is manual or scheduled.
//
// Sync model (see migration 20260530150000_event_sync_links):
//   PULL  — fetch the provider's events into `events`, reconciled via
//           `event_sync_links` (one link per event+connection).
//   PUSH  — mirror locally-created events (events.external_source IS NULL) out
//           to this connection. Each connection that runs a sync ensures every
//           local event has a copy, so a single DarAI event lands in every
//           connected calendar. Provider-origin events are NOT re-pushed to
//           other providers (avoids cross-provider duplication loops).

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  external_calendar_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  sync_enabled: boolean;
  sync_direction: string | null;
  caldav_url: string | null;
  caldav_username: string | null;
  caldav_password_encrypted: string | null;
}

export interface SyncResult {
  imported: number;
  updated: number;
  pushed: number;
  errors: string[];
}

// Minimal Supabase admin client surface used by this module.
// SupabaseQueryBuilder is a generic fluent interface; typed as a
// recursive record so the chain (.from.select.eq.maybeSingle) resolves
// without requiring the full @supabase/supabase-js types.
type SupabaseQueryBuilder = Promise<{ data: unknown; error: { message: string } | null }> & {
  [key: string]: (...args: unknown[]) => SupabaseQueryBuilder;
};
export interface CalendarAdminClient {
  from(table: string): SupabaseQueryBuilder;
}

// How far back/ahead we sync. Matches the previous window so behaviour is
// unchanged for the pull side.
function syncWindow() {
  const now = new Date();
  return {
    timeMin: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    timeMax: new Date(now.getFullYear(), now.getMonth() + 3, 0),
  };
}

function pushAllowed(conn: CalendarConnection): boolean {
  // Treat a missing direction as two-way (legacy Google connections predate the
  // column default).
  return !conn.sync_direction || conn.sync_direction === 'two_way' || conn.sync_direction === 'one_way_push';
}

function pullAllowed(conn: CalendarConnection): boolean {
  return !conn.sync_direction || conn.sync_direction === 'two_way' || conn.sync_direction === 'one_way_pull';
}

// True when the stored event already matches the incoming values — lets pull
// skip no-op writes (which would otherwise re-flag every mirror link on each
// run and cause endless push churn).
function eventUnchanged(
  row: { title: string; start_time: string; end_time: string; location: string | null; description: string | null },
  next: { title: string; start_time: string; end_time: string; location: string | null; description: string | null },
): boolean {
  const t = (a: string) => new Date(a).getTime();
  return row.title === next.title
    && t(row.start_time) === t(next.start_time)
    && t(row.end_time) === t(next.end_time)
    && (row.location || null) === (next.location || null)
    && (row.description || null) === (next.description || null);
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function getValidGoogleToken(admin: CalendarAdminClient, conn: CalendarConnection): Promise<string | null> {
  let accessToken = conn.access_token;
  const expired = conn.token_expires_at && new Date(conn.token_expires_at) < new Date();
  if (!expired) return accessToken;

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token || '',
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    console.error('Google token refresh failed:', await resp.text());
    return null;
  }
  const tokens = await resp.json();
  accessToken = tokens.access_token;
  await admin.from('external_calendar_connections').update({
    access_token: accessToken,
    token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
  }).eq('id', conn.id);
  return accessToken;
}

interface LocalEvent {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time: string;
  recurrence_rule?: string | null;
}

function googleEventBody(ev: LocalEvent) {
  // NOTE: recurrence is intentionally omitted. We pull with singleEvents=true,
  // which expands a recurring event into per-instance ids that wouldn't match
  // the master id we'd store on the link — re-importing each instance as a
  // duplicate. Recurring local events are mirrored as a single occurrence for
  // now; full recurrence round-tripping is a follow-up.
  return {
    summary: ev.title || 'Untitled',
    description: ev.description || undefined,
    location: ev.location || undefined,
    start: { dateTime: new Date(ev.start_time).toISOString() },
    end: { dateTime: new Date(ev.end_time).toISOString() },
  };
}

export async function syncGoogleConnection(admin: CalendarAdminClient, conn: CalendarConnection): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, updated: 0, pushed: 0, errors: [] };
  const accessToken = await getValidGoogleToken(admin, conn);
  if (!accessToken) {
    result.errors.push('token refresh failed — reconnect required');
    await admin.from('external_calendar_connections')
      .update({ last_sync_error: 'token refresh failed — reconnect required' }).eq('id', conn.id);
    return result;
  }

  const calendarId = conn.external_calendar_id || 'primary';
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  // ---- PULL ----
  if (pullAllowed(conn)) {
    const { timeMin, timeMax } = syncWindow();
    // NOTE: we deliberately do NOT use a stored syncToken. Google rejects
    // syncToken combined with timeMin/timeMax/orderBy (HTTP 400), which broke
    // every sync after the first. A bounded time window is simpler and robust.
    const url = new URL(base);
    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Google events fetch failed:', resp.status, txt.slice(0, 300));
      result.errors.push(`pull: ${resp.status}`);
    } else {
      const data = await resp.json();
      for (const g of data.items || []) {
        try {
          if (g.status === 'cancelled') {
            // Remove the linked local event (and the link via cascade).
            const { data: link } = await admin.from('event_sync_links').select('event_id')
              .eq('connection_id', conn.id).eq('external_id', g.id).maybeSingle();
            if (link) await admin.from('events').delete().eq('id', link.event_id);
            continue;
          }
          const start = g.start?.dateTime || g.start?.date;
          const end = g.end?.dateTime || g.end?.date;
          if (!start || !end) continue;
          const next = {
            title: g.summary || 'Untitled Event',
            description: g.description || null,
            start_time: start,
            end_time: end,
            location: g.location || null,
          };
          await reconcilePulledEvent(admin, conn, 'google', g.id, g.etag || null, next, result);
        } catch (e) {
          result.errors.push(`pull item: ${(e as Error)?.message || 'unknown'}`);
        }
      }
    }
  }

  // ---- PUSH (mirror local events to this calendar) ----
  if (pushAllowed(conn)) {
    await backfillMirrorLinks(admin, conn);
    const pending = await loadPendingLinks(admin, conn);
    for (const { link, event } of pending) {
      try {
        const isUpdate = !!link.external_id;
        const url = isUpdate ? `${base}/${encodeURIComponent(link.external_id)}` : base;
        const resp = await fetch(url, {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEventBody(event)),
        });
        if (resp.ok) {
          const remote = await resp.json();
          await admin.from('event_sync_links').update({
            external_id: remote.id,
            external_etag: remote.etag || null,
            sync_status: 'synced',
            last_error: null,
            last_pushed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', link.id);
          result.pushed++;
        } else if (isUpdate && resp.status === 404) {
          // The remote copy is gone — drop our id so the next run re-creates it.
          await admin.from('event_sync_links').update({ external_id: null, updated_at: new Date().toISOString() }).eq('id', link.id);
          result.errors.push('push update: 404 (will recreate next run)');
        } else {
          const txt = await resp.text();
          await admin.from('event_sync_links').update({
            sync_status: 'error', last_error: `${resp.status}: ${txt.slice(0, 200)}`, updated_at: new Date().toISOString(),
          }).eq('id', link.id);
          result.errors.push(`push ${isUpdate ? 'update' : 'create'}: ${resp.status}`);
        }
      } catch (e) {
        result.errors.push(`push: ${(e as Error)?.message || 'unknown'}`);
      }
    }
  }

  await admin.from('external_calendar_connections').update({
    last_synced_at: new Date().toISOString(),
    last_sync_error: result.errors.length ? result.errors.slice(0, 5).join('; ') : null,
  }).eq('id', conn.id);

  return result;
}

// ---------------------------------------------------------------------------
// Apple (CalDAV / iCloud)
// ---------------------------------------------------------------------------

function icsFmt(d: string): string {
  return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function toICS(ev: LocalEvent, uid: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DarAI//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsFmt(new Date().toISOString())}`,
    `DTSTART:${icsFmt(ev.start_time)}`,
    `DTEND:${icsFmt(ev.end_time)}`,
    `SUMMARY:${(ev.title || 'Untitled').replace(/\r?\n/g, ' ')}`,
    ev.description ? `DESCRIPTION:${String(ev.description).replace(/\r?\n/g, '\\n')}` : '',
    ev.location ? `LOCATION:${String(ev.location).replace(/\r?\n/g, ' ')}` : '',
    ev.recurrence_rule ? `RRULE:${String(ev.recurrence_rule).replace(/^RRULE:/, '')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

interface ICSEvent {
  uid: string | undefined;
  summary: string | undefined;
  description: string | undefined;
  location: string | undefined;
  dtstart: string | null;
  dtend: string | null;
}

function parseICSEvents(ics: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  for (const block of ics.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const get = (k: string) => body.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.+)$`, 'm'))?.[1]?.trim();
    // Whether the field carried an explicit timezone marker (Z or TZID).
    const hasZone = (k: string) => {
      const m = body.match(new RegExp(`^${k}([^:\\n]*):([^\\n]+)$`, 'm'));
      if (!m) return false;
      return /TZID=/i.test(m[1]) || /Z\s*$/.test(m[2]);
    };
    const dt = (raw?: string, zoned?: boolean) => {
      if (!raw) return null;
      const m = raw.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?/);
      if (!m) return null;
      const [, Y, M, D, h = '00', mn = '00', sc = '00', Z] = m;
      // Append Z (treat as UTC) only when the source actually specified UTC or a
      // timezone; bare "floating" times are left without a zone so the DB stores
      // them as-is rather than silently shifting by the runtime offset.
      const suffix = Z || zoned ? 'Z' : '';
      return `${Y}-${M}-${D}T${h}:${mn}:${sc}${suffix}`;
    };
    const dtstartRaw = get('DTSTART');
    const dtendRaw = get('DTEND');
    events.push({
      uid: get('UID'),
      summary: get('SUMMARY'),
      description: get('DESCRIPTION')?.replace(/\\n/g, '\n'),
      location: get('LOCATION'),
      dtstart: dt(dtstartRaw, hasZone('DTSTART')),
      dtend: dt(dtendRaw, hasZone('DTEND')),
    });
  }
  return events;
}

export async function syncAppleConnection(admin: CalendarAdminClient, conn: CalendarConnection): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, updated: 0, pushed: 0, errors: [] };
  const auth = btoa(`${conn.caldav_username}:${conn.caldav_password_encrypted}`);
  // Guarantee a single trailing slash so resource URLs build correctly.
  const baseUrl = (conn.caldav_url || '').replace(/\/+$/, '') + '/';

  // ---- PULL ----
  if (pullAllowed(conn)) {
    const { timeMin, timeMax } = syncWindow();
    const startWin = icsFmt(timeMin.toISOString());
    const endWin = icsFmt(timeMax.toISOString());
    const reportBody = `<?xml version="1.0"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${startWin}" end="${endWin}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;
    const resp = await fetch(baseUrl, {
      method: 'REPORT',
      headers: { Authorization: `Basic ${auth}`, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
      body: reportBody,
    });
    if (!resp.ok && resp.status !== 207) {
      const txt = await resp.text();
      console.error('Apple REPORT failed:', resp.status, txt.slice(0, 300));
      result.errors.push(`pull: ${resp.status}`);
    } else {
      const xml = await resp.text();
      const dataBlocks = [...xml.matchAll(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/gi)].map((m) => m[1].trim());
      for (const block of dataBlocks) {
        try {
          for (const ev of parseICSEvents(block)) {
            if (!ev.dtstart || !ev.dtend || !ev.uid) continue;
            const next = {
              title: ev.summary || 'Untitled',
              description: ev.description || null,
              start_time: ev.dtstart,
              end_time: ev.dtend,
              location: ev.location || null,
            };
            await reconcilePulledEvent(admin, conn, 'apple', ev.uid, null, next, result);
          }
        } catch (e) {
          result.errors.push(`pull item: ${(e as Error)?.message || 'unknown'}`);
        }
      }
    }
  }

  // ---- PUSH (mirror local events) ----
  if (pushAllowed(conn)) {
    await backfillMirrorLinks(admin, conn);
    const pending = await loadPendingLinks(admin, conn);
    for (const { link, event } of pending) {
      try {
        const uid = link.external_id || `darai-${event.id}`;
        const url = `${baseUrl}${encodeURIComponent(uid)}.ics`;
        const resp = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'text/calendar; charset=utf-8' },
          body: toICS(event, uid),
        });
        if (resp.ok || resp.status === 201 || resp.status === 204) {
          await admin.from('event_sync_links').update({
            external_id: uid,
            sync_status: 'synced',
            last_error: null,
            last_pushed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', link.id);
          result.pushed++;
        } else {
          const txt = await resp.text();
          await admin.from('event_sync_links').update({
            sync_status: 'error', last_error: `${resp.status}: ${txt.slice(0, 200)}`, updated_at: new Date().toISOString(),
          }).eq('id', link.id);
          result.errors.push(`push: ${resp.status}`);
        }
      } catch (e) {
        result.errors.push(`push: ${(e as Error)?.message || 'unknown'}`);
      }
    }
  }

  await admin.from('external_calendar_connections').update({
    last_synced_at: new Date().toISOString(),
    last_sync_error: result.errors.length ? result.errors.slice(0, 5).join('; ') : null,
  }).eq('id', conn.id);

  return result;
}

// ---------------------------------------------------------------------------
// Shared reconcile / mirror helpers
// ---------------------------------------------------------------------------

// Upsert a provider event into `events`, keyed by its (connection, external_id)
// link. Adopts legacy rows that were stored before links existed.
async function reconcilePulledEvent(
  admin: CalendarAdminClient,
  conn: CalendarConnection,
  provider: string,
  externalId: string,
  etag: string | null,
  next: { title: string; description: string | null; start_time: string; end_time: string; location: string | null },
  result: SyncResult,
) {
  // 1. Already linked to this connection?
  const { data: link } = await admin.from('event_sync_links').select('id, event_id')
    .eq('connection_id', conn.id).eq('external_id', externalId).maybeSingle();

  let eventId: string | null = link?.event_id || null;

  // 2. Legacy adopt: a row stored under the old external_source/external_id
  //    model but without a link (e.g. Google events that predate connection_id).
  if (!eventId) {
    const { data: legacy } = await admin.from('events').select('id')
      .eq('user_id', conn.user_id).eq('external_source', provider).eq('external_id', externalId).maybeSingle();
    if (legacy) eventId = legacy.id;
  }

  if (eventId) {
    const { data: row } = await admin.from('events')
      .select('title, start_time, end_time, location, description').eq('id', eventId).maybeSingle();
    if (row && !eventUnchanged(row, next)) {
      await admin.from('events').update(next).eq('id', eventId);
      result.updated++;
    }
    await admin.from('event_sync_links').upsert({
      event_id: eventId, connection_id: conn.id, external_id: externalId,
      external_etag: etag, sync_status: 'synced', updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,connection_id' });
    return;
  }

  // 3. Brand-new provider event.
  const { data: inserted, error } = await admin.from('events').insert({
    user_id: conn.user_id,
    title: next.title,
    description: next.description,
    start_time: next.start_time,
    end_time: next.end_time,
    location: next.location,
    external_source: provider,
    external_id: externalId,
    external_etag: etag,
    connection_id: conn.id,
    sync_status: 'synced',
  }).select('id').single();
  if (error) {
    result.errors.push(`insert: ${error.message}`);
    return;
  }
  await admin.from('event_sync_links').insert({
    event_id: inserted.id, connection_id: conn.id, external_id: externalId,
    external_etag: etag, sync_status: 'synced', last_pushed_at: new Date().toISOString(),
  });
  result.imported++;
}

// Ensure every locally-created event in the sync window has a (pending) link to
// this connection, so it gets mirrored out. Newly-connected calendars pick up
// existing local events here too.
async function backfillMirrorLinks(admin: CalendarAdminClient, conn: CalendarConnection) {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: locals } = await admin.from('events')
    .select('id')
    .eq('user_id', conn.user_id)
    .is('external_source', null)
    .gte('end_time', cutoff)
    .limit(500);
  if (!locals?.length) return;

  const ids = (locals as { id: string }[]).map((e) => e.id);
  const { data: existing } = await admin.from('event_sync_links')
    .select('event_id').eq('connection_id', conn.id).in('event_id', ids);
  const linked = new Set((existing as { event_id: string }[] || []).map((l) => l.event_id));

  const toInsert = ids.filter((id: string) => !linked.has(id))
    .map((event_id: string) => ({ event_id, connection_id: conn.id, sync_status: 'pending_push' }));
  if (toInsert.length) {
    await admin.from('event_sync_links').insert(toInsert);
  }
}

interface SyncLink {
  id: string;
  event_id: string;
  external_id: string | null;
  [key: string]: unknown;
}

// Pending links for this connection joined with their event payloads.
async function loadPendingLinks(admin: CalendarAdminClient, conn: CalendarConnection): Promise<Array<{ link: SyncLink; event: LocalEvent }>> {
  const { data: links } = await admin.from('event_sync_links')
    .select('*').eq('connection_id', conn.id).eq('sync_status', 'pending_push').limit(100);
  if (!links?.length) return [];
  const eventIds = (links as SyncLink[]).map((l) => l.event_id);
  const { data: events } = await admin.from('events').select('*').in('id', eventIds);
  const byId = new Map((events as LocalEvent[] || []).map((e) => [e.id, e]));
  const out: Array<{ link: SyncLink; event: LocalEvent }> = [];
  for (const link of links) {
    const event = byId.get(link.event_id);
    if (event) out.push({ link, event });
  }
  return out;
}

// Dispatch a single connection to the right provider sync.
export async function syncConnection(admin: CalendarAdminClient, conn: CalendarConnection): Promise<SyncResult> {
  if (conn.provider === 'google') return syncGoogleConnection(admin, conn);
  if (conn.provider === 'apple') return syncAppleConnection(admin, conn);
  return { imported: 0, updated: 0, pushed: 0, errors: [`unsupported provider: ${conn.provider}`] };
}
