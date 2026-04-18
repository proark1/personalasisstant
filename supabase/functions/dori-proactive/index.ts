// dori-proactive — runs every 30 min via pg_cron.
// For each user with proactive enabled + Telegram linked, evaluates triggers
// and sends an unprompted Telegram message. Logs every send to dori_proactive_log
// to prevent duplicates.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDoriReply } from '../_shared/telegram-voice.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

interface UserCtx {
  userId: string;
  chatId: number;
  settings: any;
  preferVoice: boolean;
  tz: string;
  nowLocal: Date;
  todayKey: string; // YYYY-MM-DD in user's tz
}

function localNow(tz: string): { date: Date; hour: number; minute: number; dayKey: string; dow: number } {
  // Use Intl to get parts in target timezone
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour);
  const minute = parseInt(parts.minute);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: new Date(`${dayKey}T${parts.hour}:${parts.minute}:00`), hour, minute, dayKey, dow: dowMap[parts.weekday] ?? 0 };
}

function inQuietHours(now: { hour: number }, settings: any): boolean {
  if (!settings.quiet_hours_enabled) return false;
  const start = parseInt((settings.quiet_hours_start || '22:00').split(':')[0]);
  const end = parseInt((settings.quiet_hours_end || '07:00').split(':')[0]);
  const h = now.hour;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

async function alreadySent(supabase: any, userId: string, type: string, key: string): Promise<boolean> {
  const { data } = await supabase
    .from('dori_proactive_log')
    .select('id')
    .eq('user_id', userId).eq('trigger_type', type).eq('trigger_key', key)
    .limit(1).maybeSingle();
  return !!data;
}

async function logSent(supabase: any, ctx: UserCtx, type: string, key: string, message: string) {
  await supabase.from('dori_proactive_log').insert({
    user_id: ctx.userId, trigger_type: type, trigger_key: key,
    channel: 'tg_private', channel_ref: String(ctx.chatId), message,
  });
}

async function send(ctx: UserCtx, text: string) {
  await sendDoriReply({
    chatId: ctx.chatId, text, preferVoice: ctx.preferVoice,
    lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
  });
}

// ---------- TRIGGERS ----------

async function morningBrief(supabase: any, ctx: UserCtx) {
  if (!ctx.settings.daily_review_enabled && !ctx.settings.weekly_planning_enabled) return;
  const target = ctx.settings.morning_briefing_time || '07:30:00';
  const [th, tm] = target.split(':').map((n: string) => parseInt(n));
  // Fire if within ±15 min of target
  const nowMin = ctx.nowLocal.getHours() * 60 + ctx.nowLocal.getMinutes();
  const targetMin = th * 60 + tm;
  if (Math.abs(nowMin - targetMin) > 20) return;

  const key = `morning-${ctx.todayKey}`;
  if (await alreadySent(supabase, ctx.userId, 'morning_brief', key)) return;

  // Pull today's data
  const startOfDay = new Date(ctx.nowLocal); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(ctx.nowLocal); endOfDay.setHours(23, 59, 59, 999);

  const [tasksRes, eventsRes] = await Promise.all([
    supabase.from('tasks').select('title, priority, due_date')
      .eq('user_id', ctx.userId).eq('completed', false)
      .or(`due_date.lte.${endOfDay.toISOString()},priority.in.(high,urgent)`)
      .order('priority', { ascending: false }).limit(5),
    supabase.from('events').select('title, start_time, location')
      .eq('user_id', ctx.userId)
      .gte('start_time', startOfDay.toISOString()).lte('start_time', endOfDay.toISOString())
      .order('start_time').limit(5),
  ]);

  const tasks = tasksRes.data || [];
  const events = eventsRes.data || [];
  if (tasks.length === 0 && events.length === 0) return; // nothing to say

  const lines: string[] = [`☀️ <b>Good morning!</b>`];
  if (events.length > 0) {
    lines.push(`\n📅 <b>Today (${events.length})</b>`);
    events.forEach((e: any) => {
      const t = new Date(e.start_time).toLocaleTimeString('en-GB', { timeZone: ctx.tz, hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${t} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
    });
  }
  if (tasks.length > 0) {
    lines.push(`\n✅ <b>Top tasks</b>`);
    tasks.slice(0, 3).forEach((t: any) => lines.push(`• ${t.title}${t.priority === 'high' || t.priority === 'urgent' ? ' 🔥' : ''}`));
  }
  const msg = lines.join('\n');
  await send(ctx, msg);
  await logSent(supabase, ctx, 'morning_brief', key, msg);
}

async function meetingPrep(supabase: any, ctx: UserCtx) {
  if (!ctx.settings.meeting_briefing_enabled) return;
  const minutesAhead = (ctx.settings.meeting_briefing_minutes || [15])[0] || 15;
  const now = new Date();
  const winStart = new Date(now.getTime() + (minutesAhead - 5) * 60_000);
  const winEnd = new Date(now.getTime() + (minutesAhead + 5) * 60_000);

  const { data: events } = await supabase.from('events')
    .select('id, title, start_time, location, description')
    .eq('user_id', ctx.userId)
    .gte('start_time', winStart.toISOString()).lte('start_time', winEnd.toISOString());

  for (const e of (events || [])) {
    const key = `meeting-${e.id}`;
    if (await alreadySent(supabase, ctx.userId, 'meeting_prep', key)) continue;
    const startStr = new Date(e.start_time).toLocaleTimeString('en-GB', { timeZone: ctx.tz, hour: '2-digit', minute: '2-digit' });
    const lines = [`🔔 <b>Meeting in ~${minutesAhead} min</b>`, `${e.title} at ${startStr}`];
    if (e.location) lines.push(`📍 ${e.location}`);
    if (e.description) lines.push(`\n${e.description.slice(0, 200)}`);
    const msg = lines.join('\n');
    await send(ctx, msg);
    await logSent(supabase, ctx, 'meeting_prep', key, msg);
  }
}

async function contractRenewals(supabase: any, ctx: UserCtx) {
  if (!ctx.settings.contract_renewals_enabled) return;
  const days = ctx.settings.contract_reminder_days || [30, 14, 7, 3, 1];
  const now = new Date();

  const { data: contracts } = await supabase.from('contracts')
    .select('id, name, renewal_date, cost_amount, cost_frequency, auto_renews')
    .eq('user_id', ctx.userId).eq('is_active', true)
    .not('renewal_date', 'is', null);

  for (const c of (contracts || [])) {
    const renew = new Date(c.renewal_date);
    const daysLeft = Math.ceil((renew.getTime() - now.getTime()) / (24 * 3600_000));
    if (!days.includes(daysLeft)) continue;
    const key = `contract-${c.id}-${ctx.todayKey}`;
    if (await alreadySent(supabase, ctx.userId, 'contract_renewal', key)) continue;
    const cost = c.cost_amount ? ` (€${c.cost_amount}${c.cost_frequency ? '/' + c.cost_frequency : ''})` : '';
    const verb = c.auto_renews ? 'auto-renews' : 'renews';
    const msg = `📄 <b>${c.name}</b> ${verb} in <b>${daysLeft} day${daysLeft === 1 ? '' : 's'}</b>${cost}.\nReply if you want to cancel or review.`;
    await send(ctx, msg);
    await logSent(supabase, ctx, 'contract_renewal', key, msg);
  }
}

async function staleContacts(supabase: any, ctx: UserCtx) {
  if (!ctx.settings.contact_checkins_enabled) return;
  // Only nudge once a day, evening-ish
  if (ctx.nowLocal.getHours() < 17 || ctx.nowLocal.getHours() > 20) return;
  const key = `stale-contacts-${ctx.todayKey}`;
  if (await alreadySent(supabase, ctx.userId, 'stale_contact', key)) return;

  const days = ctx.settings.stale_contact_days || 60;
  const cutoff = new Date(Date.now() - days * 24 * 3600_000).toISOString();

  const { data: contacts } = await supabase.from('user_contacts')
    .select('id, name, last_contacted_at, relationship_tier')
    .eq('user_id', ctx.userId)
    .or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoff}`)
    .eq('relationship_tier', 'close')
    .limit(3);

  if (!contacts || contacts.length === 0) return;
  const names = contacts.map((c: any) => c.name).join(', ');
  const msg = `👋 You haven't talked to <b>${names}</b> in a while. Want to send a quick voice note or schedule a call?`;
  await send(ctx, msg);
  await logSent(supabase, ctx, 'stale_contact', key, msg);
}

// ---------- MAIN ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find all users with active settings + linked private telegram
  const { data: users, error } = await supabase
    .from('proactive_settings')
    .select(`user_id, enabled, prefer_voice_replies, timezone, morning_briefing_time, evening_review_time,
             daily_review_enabled, weekly_planning_enabled, meeting_briefing_enabled, meeting_briefing_minutes,
             contract_renewals_enabled, contract_reminder_days, contact_checkins_enabled, stale_contact_days,
             telegram_proactive_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end`)
    .eq('enabled', true).eq('telegram_proactive_enabled', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0;
  let sent = 0;

  for (const s of (users || [])) {
    try {
      const { data: link } = await supabase.from('telegram_links')
        .select('chat_id, is_active').eq('user_id', s.user_id).maybeSingle();
      if (!link || !link.is_active || !link.chat_id) continue;

      const tz = s.timezone || 'Europe/Berlin';
      const now = localNow(tz);
      if (inQuietHours(now, s)) continue;

      const ctx: UserCtx = {
        userId: s.user_id, chatId: Number(link.chat_id), settings: s,
        preferVoice: !!s.prefer_voice_replies, tz, nowLocal: now.date, todayKey: now.dayKey,
      };

      const before = sent;
      await morningBrief(supabase, ctx);
      await meetingPrep(supabase, ctx);
      await contractRenewals(supabase, ctx);
      await staleContacts(supabase, ctx);
      processed++;
      // crude counter via log table re-read avoided; trust no-throw means OK
      sent = before; // leave at 0 — we just count attempts
    } catch (e) {
      console.error('user loop failed', s.user_id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
