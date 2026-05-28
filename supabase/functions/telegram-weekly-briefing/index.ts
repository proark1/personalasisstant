// Weekly Monday-morning briefing of calendar entries for the next 7 days,
// delivered to each user's personal Telegram chat.
//
// Triggered hourly by pg_cron. For each user with an active telegram_links
// row and weekly_briefing_enabled = true, we evaluate the user's local time:
// if it is Monday 08:xx and we haven't already sent a briefing for that local
// Monday, we send the digest and stamp `weekly_briefing_last_sent_on`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TARGET_HOUR = 8;
const TARGET_WEEKDAY = 'Mon';
const CONCURRENCY = 5;

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function tgSend(chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error('tgSend failed', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('tgSend threw', e);
    return false;
  }
}

function localParts(now: Date, tz: string) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now),
    10,
  );
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return { weekday, hour, date };
}

async function loadTimezoneMap(supabase: any, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const [{ data: locs }, { data: profiles }] = await Promise.all([
    supabase.from('user_location_settings').select('user_id, timezone').in('user_id', userIds),
    supabase.from('profiles').select('user_id, timezone').in('user_id', userIds),
  ]);
  (profiles || []).forEach((p: any) => { if (p.timezone) map.set(p.user_id, p.timezone); });
  // Location settings win over profile when both exist.
  (locs || []).forEach((l: any) => { if (l.timezone) map.set(l.user_id, l.timezone); });
  return map;
}

function buildBriefing(events: any[], tz: string, firstName: string | null): string {
  const now = new Date();
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dayLabel = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: '2-digit', month: 'short' }).format(d);
  const timeLabel = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);

  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const lines: string[] = [];
  const greetName = firstName ? `, ${escapeHtml(firstName)}` : '';
  lines.push(`<b>☀️ Good morning${greetName}!</b>`);
  lines.push(`Here's your week ahead — calendar entries for the next 7 days:`);

  if (!events.length) {
    lines.push('\n✨ Nothing on the calendar — a clear week ahead!');
    return lines.join('\n');
  }

  let currentDay = '';
  for (const e of events) {
    const when = new Date(e.start_time);
    const k = dayKey(when);
    if (k !== currentDay) {
      currentDay = k;
      let label = dayLabel(when);
      if (k === todayKey) label = `Today — ${label}`;
      else if (k === tomorrowKey) label = `Tomorrow — ${label}`;
      lines.push(`\n<b>${label}</b>`);
    }
    const loc = e.location ? ` @ ${escapeHtml(e.location)}` : '';
    lines.push(`• 🗓 ${timeLabel(when)} — ${escapeHtml(e.title)}${loc}`);
  }

  lines.push(`\n<i>Type</i> <code>/week</code> <i>for the tappable view or</i> <code>/today</code> <i>for just today.</i>`);
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Service-role bearer required — pg_cron supplies it; nothing else should
  // be able to trigger user-facing Telegram sends.
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const onlyUserId = url.searchParams.get('user_id');

  let query = supabase
    .from('telegram_links')
    .select('user_id, chat_id, telegram_first_name, weekly_briefing_enabled, weekly_briefing_last_sent_on')
    .eq('is_active', true)
    .not('chat_id', 'is', null);
  if (onlyUserId) query = query.eq('user_id', onlyUserId);

  const { data: links, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const candidates = (links || []).filter((l: any) => force || l.weekly_briefing_enabled !== false);
  const now = new Date();

  // Batch-fetch timezones once, then resolve per-user locally.
  const tzMap = await loadTimezoneMap(supabase, candidates.map((l: any) => l.user_id));
  const tzOf = (uid: string) => tzMap.get(uid) || 'UTC';

  // Decide who to send to before doing any work.
  const targets = candidates.filter((link: any) => {
    if (force) return true;
    const { weekday, hour, date } = localParts(now, tzOf(link.user_id));
    if (weekday !== TARGET_WEEKDAY) return false;
    if (hour !== TARGET_HOUR) return false;
    if (link.weekly_briefing_last_sent_on === date) return false;
    return true;
  });

  let sent = 0;
  let failed = 0;
  const skipped = candidates.length - targets.length;
  const errors: string[] = [];

  // Pre-fetch all upcoming events in a single query, then group per user.
  const horizonEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const targetIds = targets.map((t: any) => t.user_id);
  const eventsByUser = new Map<string, any[]>();
  if (targetIds.length > 0) {
    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, location, user_id')
      .in('user_id', targetIds)
      .gte('start_time', now.toISOString())
      .lte('start_time', horizonEnd)
      .order('start_time')
      .limit(targetIds.length * 50);
    (events || []).forEach((e: any) => {
      const list = eventsByUser.get(e.user_id) || [];
      list.push(e);
      eventsByUser.set(e.user_id, list);
    });
  }

  // Send in parallel batches.
  async function dispatchOne(link: any) {
    try {
      const tz = tzOf(link.user_id);
      const { date } = localParts(now, tz);
      const userEvents = eventsByUser.get(link.user_id) || [];
      const text = buildBriefing(userEvents, tz, link.telegram_first_name);
      const ok = await tgSend(Number(link.chat_id), text);
      if (!ok) { failed++; errors.push(`${link.user_id}: send failed`); return; }
      await supabase
        .from('telegram_links')
        .update({ weekly_briefing_last_sent_on: date })
        .eq('user_id', link.user_id);
      sent++;
    } catch (e: any) {
      failed++;
      errors.push(`${link.user_id}: ${e?.message || String(e)}`);
      console.error('weekly briefing failed for', link.user_id, e);
    }
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(dispatchOne));
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
