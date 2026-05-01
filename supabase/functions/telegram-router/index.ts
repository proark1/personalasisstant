// Classifies inbound Telegram group messages and writes to the right module.
// Called by telegram-poll for messages from a linked family group.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDoriReply } from '../_shared/telegram-voice.ts';
import {
  approveAndExecutePending,
  buildConfirmKeyboard,
  classifyConfirmationText,
  fetchLatestPendingForChat,
  rejectPending,
  tgSendWithKeyboard,
} from '../_shared/telegram-confirm.ts';
import {
  buildContractRowKeyboard,
  buildEventRowKeyboard,
  buildShoppingRowKeyboard,
  buildTaskRowKeyboard,
  buildUndoKeyboard,
} from '../_shared/telegram-inline.ts';
import { fetchLatestUndoableForUser, runUndo } from '../_shared/dori-undo.ts';
import { buildDoriContext } from '../_shared/dori-context.ts';
import { findTimeSlots, rankProposedSlots } from '../_shared/dori-scheduling.ts';
import { buildWorkspaceWeeklyRecap, formatRecapForTelegram } from '../_shared/dori-recap.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tgSend(chatId: number, text: string, replyMarkup?: unknown) {
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch (e) {
    console.error('tgSend failed', e);
  }
}

// /plans — list active plans for the user with inline keyboard
// (Run next / Skip / Abort) per plan. The callback handler in
// telegram-poll dispatches to dori-plan-execute.
async function handlePlansCommand(supabase: any, chatId: number, userId: string | null) {
  if (!userId) {
    await tgSend(chatId, '📋 Link this chat with /linkme first to see your plans.');
    return;
  }
  const { data: plans, error } = await supabase
    .from('dori_action_plans')
    .select('id, title, status, completed_step_count, step_count, current_step_idx, blocks:dori_plan_steps(idx,title,status)')
    .eq('user_id', userId)
    .in('status', ['awaiting_confirm', 'running', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(5);
  if (error) {
    await tgSend(chatId, `⚠️ Couldn't load plans: ${error.message}`);
    return;
  }
  if (!plans || plans.length === 0) {
    await tgSend(chatId, "📋 No active plans. Ask Dori to plan something multi-step (\"plan my Dubai trip\", \"set up a weekly review\") and it'll appear here.");
    return;
  }
  // Build the inline keyboard import once.
  const { buildPlanRowKeyboard } = await import('../_shared/telegram-inline.ts');
  for (const p of plans as Array<any>) {
    const nextStep = Array.isArray(p.blocks)
      ? p.blocks
        .filter((s: any) => s.status === 'pending' || s.status === 'awaiting_confirm')
        .sort((a: any, b: any) => a.idx - b.idx)[0]
      : null;
    const text = [
      `📋 <b>${escapeHtml(p.title)}</b>`,
      `${p.completed_step_count}/${p.step_count} done · <i>${p.status}</i>`,
      nextStep ? `\nNext: ${escapeHtml(nextStep.title)}` : '\nNo pending steps.',
    ].join('\n');
    await tgSend(chatId, text, buildPlanRowKeyboard(p.id));
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Help / discoverability ──────────────────────────────────────────────
const HELP_TEXT = `<b>🤖 Dori — Your Assistant</b>

Just talk naturally — I'll save tasks, shopping, events, and more.
Send a <b>photo</b> (receipt, bill, business card, prescription) and I'll
read it. Send a <b>voice note</b> and I'll act on what you said.

<b>📅 Schedule</b>
/me — your day at a glance
/today · /tomorrow — tappable cards (✅ Done, ⏰ +1h, 📅 +1d, 🗑)
/week — next 7 days overview
/agenda — same as /today
/overdue — open tasks past their due date
/free [duration] [day] — e.g. <code>/free 2h thursday</code>
/agenda &lt;YYYY-MM-DD&gt; — past or future date lookup
/load — meeting hours per member this week
/snooze — push today's tasks to tomorrow
/done — what you've completed this week
/schedule &lt;title&gt; with @a @b for 30m — find a time

<b>🧑‍🤝‍🧑 Team (workspace groups)</b>
/standup — per-member yesterday / today / blockers
/recap — weekly recap
/comment &lt;task&gt; :: &lt;text&gt; — comment on a task
/linkworkspace &lt;code&gt; — bind this chat to a workspace
<i>In private chat: <code>/workspace Acme</code> to scope your next commands to that workspace.</i>

<b>➕ Quick add</b>
/add &lt;task&gt; · /buy &lt;item&gt; · /event &lt;title&gt; @ &lt;time&gt;
/note &lt;text&gt; · /notes &lt;query&gt; · /remind &lt;text&gt;

<b>↩️ Safety net</b>
/undo — reverse the last action (within 5 minutes)
/focus on 2h — silence Dori's nudges (also: /focus off)
Reply <b>yes</b> / <b>no</b> to confirm any action I propose.

<b>👨‍👩‍👧 Family &amp; people</b>
/birthdays · /contacts &lt;name&gt; · /linkme

<b>💶 Money &amp; assets</b>
/contracts · /expiring · /properties · /vehicles
/expense &lt;amount&gt; [category] [note] — log a one-off expense
/spent [category] [period] — totals (today/week/month/year)

<b>❤️ Health &amp; wellbeing</b>
/health · /checkin

<b>📧 Email</b>
/inbox · /actions · /draft &lt;subject or sender&gt;

<b>🕌 Islam</b>
/prayers · /qibla [city] · /quran &lt;name|1-114&gt; · /dhikr [count]

<b>🧹 Household</b>
/chores — recurring chores across the family
/whoseturn &lt;chore&gt; — next person up in the rotation
/menu — today's planned meals

<b>🌐 Misc</b>
/weather &lt;city&gt; — today + tomorrow forecast
/lang de|en — switch language
/recent — Dori's last 5 actions
/tz &lt;city&gt; — local time · /fx 100 EUR USD — convert

<b>🆕 Power tools</b>
/budget set food 500 · /budget check food
/pantry list · /pantry add eggs 12
/meds &lt;name&gt; · /period start|end · /fasting start|end
/flight LH123 2026-05-10 · /status home|away|work|travel
/zakat 10000 · /summary (unread emails digest)
/subtask &lt;parent&gt; :: &lt;child&gt; · /tag &lt;task&gt; +work · /estimate &lt;task&gt; 30

<b>⚙️ Settings</b>
/quiet on|off · /voice on|off

<i>Tip: Try "add milk to shopping", "move dentist to Friday", "what's Sarah doing tomorrow", "delete that task".</i>

<b>🇩🇪 Tipp:</b> Schreib einfach normal — "Milch auf Einkaufsliste", "Termin morgen 14 Uhr Zahnarzt", "Was steht heute an?". Antworte mit <b>ja</b> / <b>nein</b>, um Aktionen zu bestätigen, oder schick <b>/undo</b>, um das Letzte rückgängig zu machen.`;

const HELP_TRIGGERS = [
  'dori help', 'dori commands', 'dori menu', 'dori was kannst du',
  'what can you do', 'help me', 'show commands', 'show menu',
  'hilfe', 'dori hilfe', 'was kannst du',
];

function isHelpRequest(lower: string): boolean {
  if (['/help', '/start', '/commands', '/menu'].includes(lower)) return true;
  if (lower.startsWith('/help') || lower.startsWith('/start')) return true;
  return HELP_TRIGGERS.some(t => lower.includes(t));
}

// ─── Household resolution ────────────────────────────────────────────────
async function getHouseholdMembers(supabase: any, ownerId: string, partnerId: string | null) {
  const ids = [ownerId, partnerId].filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name, email').in('user_id', ids);
  const map = new Map<string, string>();
  (profiles || []).forEach((p: any) => map.set(p.user_id, p.display_name || (p.email?.split('@')[0]) || 'Member'));
  return { ids, nameOf: (uid: string) => map.get(uid) || 'Member', multi: ids.length > 1 };
}

// ─── Slash command handlers ─────────────────────────────────────────────
// Fast personal digest: what's on this user's plate right now.
// Purely DB-driven (no AI round-trip) so the reply is instant.
async function handleMeDigest(
  supabase: any,
  userId: string,
  workspaceId: string | null,
  tz?: string,
): Promise<string> {
  const ctx = await buildDoriContext(supabase, userId, workspaceId, { timezone: tz });
  const lines: string[] = [];
  lines.push(`<b>🌤 Your day</b>${workspaceId ? ` <i>(workspace)</i>` : ''}`);

  if (ctx.overdueCount > 0) {
    lines.push(`\n⚠️ <b>${ctx.overdueCount} overdue</b> — worth tackling first.`);
  }

  if (ctx.todayEvents.length > 0) {
    lines.push(`\n<b>Today's events</b>`);
    ctx.todayEvents.forEach((e) => {
      const t = new Date(e.start_time).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${t} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
    });
  }

  // "Due today" uses the caller's tz to decide what "today" means; without
  // tz the edge runtime's UTC midnight would mis-classify borderline items.
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dueToday = ctx.openTasks.filter((t) => {
    if (!t.due_date) return false;
    const dueYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t.due_date));
    return dueYmd === todayYmd;
  });
  if (dueToday.length > 0) {
    lines.push(`\n<b>Due today</b>`);
    dueToday.slice(0, 8).forEach((t) => {
      const pr = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⚪️' : '🟡';
      lines.push(`${pr} ${t.title}`);
    });
  }

  if (ctx.tomorrowEvents.length > 0) {
    lines.push(`\n<b>Tomorrow</b> — ${ctx.tomorrowEvents.length} event${ctx.tomorrowEvents.length === 1 ? '' : 's'}, first at ${new Date(ctx.tomorrowEvents[0].start_time).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}.`);
  }

  if (ctx.openTasks.length === 0 && ctx.todayEvents.length === 0 && ctx.tomorrowEvents.length === 0) {
    lines.push(`\nNothing on your plate. Enjoy. ☕`);
  } else if (ctx.scope === 'workspace' && ctx.recentCompletedCount > 0) {
    lines.push(`\n✅ ${ctx.recentCompletedCount} task${ctx.recentCompletedCount === 1 ? '' : 's'} shipped across the team in the last 24h.`);
  }

  return lines.join('\n');
}

// Team standup: per-member "yesterday / today / blockers" summary, generated
// from completed tasks + events + open tasks. Only meaningful inside a
// linked workspace — the family-group fallback just points to /today.
async function handleStandup(
  supabase: any,
  workspaceId: string,
  tz?: string,
): Promise<string> {
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, display_name')
    .eq('workspace_id', workspaceId);
  if (!members?.length) return 'No members found for this workspace.';

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setHours(23, 59, 59, 999);
  const startOfTomorrow = new Date(endOfToday.getTime() + 1);
  const endOfTomorrow = new Date(startOfTomorrow); endOfTomorrow.setHours(23, 59, 59, 999);

  // Pull the needed data for ALL members in parallel.
  const memberIds = (members as any[]).map((m: any) => m.user_id);
  const [{ data: yesterdayDone }, { data: todayTasks }, { data: upcomingEvents }] = await Promise.all([
    supabase.from('tasks')
      .select('title, assignee_id, user_id, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('completed', true)
      .gte('updated_at', since.toISOString())
      .limit(200),
    supabase.from('tasks')
      .select('title, assignee_id, user_id, priority, due_date')
      .eq('workspace_id', workspaceId)
      .eq('completed', false)
      .eq('trashed', false)
      .lte('due_date', endOfToday.toISOString())
      .limit(200),
    supabase.from('events')
      .select('title, start_time, assignee_id, user_id')
      .eq('workspace_id', workspaceId)
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfTomorrow.toISOString())
      .order('start_time'),
  ]);

  // Group by owner (assignee_id if present, else user_id).
  const byMember = new Map<string, { done: string[]; today: string[]; events: string[] }>();
  for (const uid of memberIds) byMember.set(uid, { done: [], today: [], events: [] });
  for (const t of (yesterdayDone || [])) {
    const m = byMember.get(t.assignee_id || t.user_id);
    if (m) m.done.push(t.title);
  }
  for (const t of (todayTasks || [])) {
    const m = byMember.get(t.assignee_id || t.user_id);
    if (m) m.today.push(t.title);
  }
  for (const ev of (upcomingEvents || [])) {
    const m = byMember.get(ev.assignee_id || ev.user_id);
    if (m) {
      const when = new Date(ev.start_time).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      m.events.push(`${when} ${ev.title}`);
    }
  }

  const lines: string[] = ['<b>🧑‍🤝‍🧑 Standup</b>'];
  let anyActivity = false;
  for (const m of members as any[]) {
    const entry = byMember.get(m.user_id);
    if (!entry) continue;
    const block: string[] = [`\n<b>${m.display_name || m.user_id.slice(0, 8)}</b>`];
    if (entry.done.length === 0 && entry.today.length === 0 && entry.events.length === 0) {
      block.push('• <i>(no activity)</i>');
    } else {
      anyActivity = true;
      if (entry.done.length) block.push(`✅ <i>Yesterday:</i> ${entry.done.slice(0, 5).join(' · ')}${entry.done.length > 5 ? ` (+${entry.done.length - 5})` : ''}`);
      if (entry.today.length) block.push(`📌 <i>Today:</i> ${entry.today.slice(0, 5).join(' · ')}${entry.today.length > 5 ? ` (+${entry.today.length - 5})` : ''}`);
      if (entry.events.length) block.push(`📅 <i>Scheduled:</i> ${entry.events.slice(0, 3).join(' · ')}`);
    }
    lines.push(block.join('\n'));
  }
  if (!anyActivity) lines.push('\n<i>Quiet standup — nobody has activity logged.</i>');
  return lines.join('\n');
}

async function handleAgenda(supabase: any, ids: string[], dayOffset = 0): Promise<string> {
  const start = new Date(); start.setDate(start.getDate() + dayOffset); start.setHours(0,0,0,0);
  const end = new Date(start); end.setHours(23,59,59,999);
  const label = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : start.toLocaleDateString('en-GB', { weekday: 'long' });

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events').select('title, start_time, location, user_id')
      .in('user_id', ids).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time'),
    supabase.from('tasks').select('title, due_date, user_id')
      .in('user_id', ids).eq('completed', false).eq('trashed', false)
      .gte('due_date', start.toISOString()).lte('due_date', end.toISOString())
      .order('due_date').limit(15),
  ]);

  const lines: string[] = [`<b>📅 ${label}'s agenda</b>`];
  if (events?.length) {
    lines.push('\n<b>Events</b>');
    events.forEach((e: any) => {
      const t = new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${t} — ${e.title}${e.location ? ` (${e.location})` : ''}`);
    });
  }
  if (tasks?.length) {
    lines.push('\n<b>Open tasks</b>');
    tasks.forEach((t: any) => lines.push(`• ${t.title}`));
  }
  if (!events?.length && !tasks?.length) lines.push('\nNothing scheduled — enjoy. ☕');
  return lines.join('\n');
}

async function handleWeek(supabase: any, ids: string[], household: any): Promise<string> {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23,59,59,999);

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events').select('title, start_time, user_id')
      .in('user_id', ids).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time').limit(50),
    supabase.from('tasks').select('title, due_date, user_id')
      .in('user_id', ids).eq('completed', false).eq('trashed', false)
      .gte('due_date', start.toISOString()).lte('due_date', end.toISOString())
      .order('due_date').limit(30),
  ]);

  const byDay = new Map<string, string[]>();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

  (events || []).forEach((e: any) => {
    const d = new Date(e.start_time);
    const k = dayKey(d);
    const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const who = household.multi ? ` <i>(${household.nameOf(e.user_id)})</i>` : '';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(`• ${t} ${e.title}${who}`);
  });
  (tasks || []).forEach((t: any) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    const k = dayKey(d);
    const who = household.multi ? ` <i>(${household.nameOf(t.user_id)})</i>` : '';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(`☑️ ${t.title}${who}`);
  });

  const out: string[] = ['<b>🗓 Next 7 days</b>'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const items = byDay.get(dayKey(d));
    if (items?.length) {
      out.push(`\n<b>${dayLabel(d)}</b>`);
      items.forEach(l => out.push(l));
    }
  }
  if (out.length === 1) out.push('\nNothing scheduled this week.');
  return out.join('\n');
}

async function handleUpcomingMeetings(supabase: any, ids: string[], household: any, tz?: string): Promise<string> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 14);

  const { data: events } = await supabase.from('events')
    .select('title, start_time, location, user_id')
    .in('user_id', ids)
    .gte('start_time', now.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time')
    .limit(10);

  const upcoming = (events || []).filter((e: any) => {
    const title = String(e.title || '').toLowerCase();
    return /\b(meet|meeting|call|sync|standup|review|interview|appointment|demo)\b/.test(title);
  });

  if (!upcoming.length) return '📅 No upcoming meetings in the next 14 days.';

  const lines = ['<b>📅 Upcoming meetings</b>'];
  upcoming.forEach((e: any) => {
    const when = new Date(e.start_time).toLocaleString('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const who = household.multi ? ` <i>(${household.nameOf(e.user_id)})</i>` : '';
    lines.push(`• ${when} — ${e.title}${e.location ? ` (${e.location})` : ''}${who}`);
  });
  return lines.join('\n');
}

async function handleShoppingList(supabase: any, ownerId: string): Promise<string> {
  const { data: lists } = await supabase.from('shopping_lists')
    .select('id, name').eq('user_id', ownerId).eq('is_completed', false)
    .order('created_at', { ascending: true });
  if (!lists?.length) return '🛒 No active shopping lists.';
  const out: string[] = [];
  for (const list of lists) {
    const { data: items } = await supabase.from('shopping_list_items')
      .select('name, quantity, is_checked').eq('list_id', list.id).eq('is_checked', false);
    out.push(`<b>🛒 ${list.name}</b>`);
    if (items?.length) items.forEach((i: any) => out.push(`• ${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`));
    else out.push('  (empty)');
  }
  return out.join('\n');
}

// Tappable shopping list: one compact message per item with a ☑️ Got it + 🗑 Remove keyboard.
// Long lists are capped; the plain-text view above stays available for overview.
async function sendTappableShoppingList(
  chatId: number,
  supabase: any,
  ownerId: string,
  lovableKey: string,
  telegramKey: string,
): Promise<boolean> {
  const { data: lists } = await supabase.from('shopping_lists')
    .select('id, name').eq('user_id', ownerId).eq('is_completed', false)
    .order('created_at', { ascending: true });
  if (!lists?.length) return false;

  let totalSent = 0;
  const MAX_TAPPABLE = 12;
  for (const list of lists) {
    const { data: items } = await supabase.from('shopping_list_items')
      .select('id, name, quantity, is_checked')
      .eq('list_id', list.id).eq('is_checked', false).order('created_at');
    if (!items?.length) continue;
    await tgSend(chatId, `<b>🛒 ${list.name}</b> — tap to check off`);
    for (const item of items) {
      if (totalSent >= MAX_TAPPABLE) {
        await tgSend(chatId, `… and ${(items.length - totalSent)} more. Use the app for the full list.`);
        break;
      }
      await tgSendWithKeyboard(
        chatId,
        `• ${item.quantity > 1 ? `${item.quantity}× ` : ''}${item.name}`,
        buildShoppingRowKeyboard(item.id, false),
        lovableKey,
        telegramKey,
      );
      totalSent++;
    }
  }
  return totalSent > 0;
}

// Tappable agenda: sends header + one card per task/event with row action buttons.
async function sendTappableAgenda(
  chatId: number,
  supabase: any,
  memberIds: string[],
  dayOffset: number,
  lovableKey: string,
  telegramKey: string,
): Promise<boolean> {
  const start = new Date(); start.setDate(start.getDate() + dayOffset); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  const label = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : start.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' });

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events').select('id, title, start_time, location, user_id')
      .in('user_id', memberIds).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time'),
    supabase.from('tasks').select('id, title, due_date, priority, user_id')
      .in('user_id', memberIds).eq('completed', false).eq('trashed', false)
      .gte('due_date', start.toISOString()).lte('due_date', end.toISOString())
      .order('due_date').limit(15),
  ]);

  const totalItems = (events?.length || 0) + (tasks?.length || 0);
  if (totalItems === 0) {
    await tgSend(chatId, `<b>📅 ${label}</b>\nNothing scheduled — enjoy. ☕`);
    return true;
  }

  await tgSend(chatId, `<b>📅 ${label}</b> — ${events?.length || 0} events, ${tasks?.length || 0} open tasks. Tap a card to act on it.`);
  let sent = 0;
  const MAX_CARDS = 12;
  for (const e of events || []) {
    if (sent >= MAX_CARDS) break;
    const t = new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const line = `🕐 ${t} — <b>${e.title}</b>${e.location ? `\n📍 ${e.location}` : ''}`;
    await tgSendWithKeyboard(chatId, line, buildEventRowKeyboard(e.id), lovableKey, telegramKey);
    sent++;
  }
  for (const t of tasks || []) {
    if (sent >= MAX_CARDS) break;
    const pr = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⚪️' : '🟡';
    const line = `${pr} <b>${t.title}</b>`;
    await tgSendWithKeyboard(chatId, line, buildTaskRowKeyboard(t.id), lovableKey, telegramKey);
    sent++;
  }
  if (totalItems > sent) {
    await tgSend(chatId, `… and ${totalItems - sent} more. Ask me about specific items for details.`);
  }
  return true;
}

async function handleBirthdays(supabase: any, ids: string[], household: any): Promise<string> {
  const { data } = await supabase.from('contact_special_dates')
    .select('occurs_on, date_type, contact_id, user_id, user_contacts(name)')
    .in('user_id', ids).eq('date_type', 'birthday');
  if (!data?.length) return '🎂 No birthdays on file.';

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = (data as any[])
    .map(d => {
      const orig = new Date(d.occurs_on);
      const next = new Date(today.getFullYear(), orig.getMonth(), orig.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const days = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { ...d, next, days };
    })
    .filter(d => d.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (!upcoming.length) return '🎂 No birthdays in the next 30 days.';
  const lines = ['<b>🎂 Upcoming birthdays</b>'];
  upcoming.forEach(b => {
    const name = b.user_contacts?.name || 'Unknown';
    const when = b.days === 0 ? 'today!' : b.days === 1 ? 'tomorrow' : `in ${b.days}d (${b.next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`;
    const who = household.multi ? ` <i>— ${household.nameOf(b.user_id)}'s contact</i>` : '';
    lines.push(`• ${name}${who} — ${when}`);
  });
  return lines.join('\n');
}

async function handleContacts(supabase: any, ids: string[], query: string): Promise<string> {
  const q = query.trim();
  if (!q) return 'Usage: <code>/contacts &lt;name&gt;</code>';
  const { data } = await supabase.from('user_contacts')
    .select('name, phone, email, user_id').in('user_id', ids).ilike('name', `%${q}%`).limit(8);
  if (!data?.length) return `🔍 No contacts matching "${q}".`;
  const lines = [`<b>🔍 Contacts matching "${q}"</b>`];
  (data as any[]).forEach(c => {
    const bits = [c.name];
    if (c.phone) bits.push(c.phone);
    if (c.email) bits.push(c.email);
    lines.push(`• ${bits.join(' — ')}`);
  });
  return lines.join('\n');
}

async function handleContracts(supabase: any, ids: string[], expiringOnly: boolean): Promise<string> {
  let q = supabase.from('contracts').select('name, provider, cost_amount, cost_frequency, renewal_date, end_date, user_id')
    .in('user_id', ids).eq('is_active', true);
  if (expiringOnly) {
    const in60 = new Date(); in60.setDate(in60.getDate() + 60);
    q = q.or(`renewal_date.lte.${in60.toISOString().slice(0,10)},end_date.lte.${in60.toISOString().slice(0,10)}`);
  }
  const { data } = await q.order('renewal_date', { nullsFirst: false }).limit(20);
  if (!data?.length) return expiringOnly ? '✅ Nothing expiring in the next 60 days.' : '📄 No active contracts.';
  const title = expiringOnly ? '⏳ Expiring soon (60 days)' : '📄 Active contracts';
  const lines = [`<b>${title}</b>`];
  (data as any[]).forEach(c => {
    const cost = c.cost_amount ? ` — ${c.cost_amount}€${c.cost_frequency ? '/' + c.cost_frequency : ''}` : '';
    const due = c.renewal_date || c.end_date;
    const when = due ? ` (until ${new Date(due).toLocaleDateString('en-GB')})` : '';
    lines.push(`• ${c.name}${c.provider ? ` — ${c.provider}` : ''}${cost}${when}`);
  });
  return lines.join('\n');
}

async function handleProperties(supabase: any, ids: string[]): Promise<string> {
  const { data } = await supabase.from('properties')
    .select('name, property_type, city, country, current_value').in('user_id', ids).eq('is_active', true);
  if (!data?.length) return '🏠 No properties on file.';
  const lines = ['<b>🏠 Properties</b>'];
  (data as any[]).forEach(p => {
    const loc = [p.city, p.country].filter(Boolean).join(', ');
    const val = p.current_value ? ` — €${Number(p.current_value).toLocaleString()}` : '';
    lines.push(`• ${p.name} (${p.property_type})${loc ? ` — ${loc}` : ''}${val}`);
  });
  return lines.join('\n');
}

async function handleVehicles(supabase: any, ids: string[]): Promise<string> {
  const { data } = await supabase.from('vehicles')
    .select('name, make, model, year, license_plate, next_service_date, insurance_renewal').in('user_id', ids);
  if (!data?.length) return '🚗 No vehicles on file.';
  const lines = ['<b>🚗 Vehicles</b>'];
  (data as any[]).forEach(v => {
    const desc = [v.year, v.make, v.model].filter(Boolean).join(' ');
    const plate = v.license_plate ? ` [${v.license_plate}]` : '';
    const upcoming: string[] = [];
    if (v.next_service_date) upcoming.push(`service ${new Date(v.next_service_date).toLocaleDateString('en-GB')}`);
    if (v.insurance_renewal) upcoming.push(`insurance ${new Date(v.insurance_renewal).toLocaleDateString('en-GB')}`);
    lines.push(`• ${v.name}${desc ? ` — ${desc}` : ''}${plate}${upcoming.length ? `\n  ↳ ${upcoming.join(', ')}` : ''}`);
  });
  return lines.join('\n');
}

async function handleHealth(supabase: any, ids: string[], household: any): Promise<string> {
  const since = new Date(); since.setHours(0,0,0,0);
  const lines = ['<b>❤️ Today\'s health</b>'];
  let any = false;
  for (const uid of ids) {
    const { data } = await supabase.from('health_metrics')
      .select('metric_type, value, unit, recorded_at')
      .eq('user_id', uid).gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: false }).limit(20);
    if (!data?.length) continue;
    any = true;
    const latest = new Map<string, any>();
    (data as any[]).forEach(m => { if (!latest.has(m.metric_type)) latest.set(m.metric_type, m); });
    const prefix = household.multi ? `<b>${household.nameOf(uid)}</b> — ` : '';
    const bits = Array.from(latest.values()).map(m => `${m.metric_type}: ${m.value}${m.unit}`).join(', ');
    lines.push(`• ${prefix}${bits}`);
  }
  if (!any) lines.push('No metrics logged today yet.');
  return lines.join('\n');
}

async function handleCheckin(supabase: any, ids: string[], household: any): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('daily_checkins')
    .select('user_id, mood, energy_level, sleep_hours, day_rating, checkin_type')
    .in('user_id', ids).eq('checkin_date', today);
  if (!data?.length) return '📝 No check-ins logged today yet.';
  const lines = ['<b>📝 Today\'s check-ins</b>'];
  (data as any[]).forEach(c => {
    const prefix = household.multi ? `<b>${household.nameOf(c.user_id)}</b> ` : '';
    const bits: string[] = [];
    if (c.mood) bits.push(`mood ${c.mood}`);
    if (c.energy_level) bits.push(`energy ${c.energy_level}`);
    if (c.sleep_hours) bits.push(`sleep ${c.sleep_hours}h`);
    if (c.day_rating) bits.push(`rating ${c.day_rating}/10`);
    lines.push(`• ${prefix}(${c.checkin_type}) ${bits.join(', ') || '—'}`);
  });
  return lines.join('\n');
}

async function handleEmailActions(supabase: any, ids: string[], household: any, priorityOnly: boolean): Promise<string> {
  let q = supabase.from('email_classifications')
    .select('category, suggested_action, suggested_payload, user_id, created_at')
    .in('user_id', ids).eq('status', 'pending');
  if (priorityOnly) q = q.in('category', ['important', 'urgent', 'action_required']);
  const { data } = await q.order('created_at', { ascending: false }).limit(15);
  if (!data?.length) return priorityOnly ? '📭 Inbox clear.' : '✅ No pending email actions.';
  const lines = [`<b>${priorityOnly ? '📥 Priority inbox' : '📧 Email actions'}</b>`];
  (data as any[]).forEach(e => {
    const prefix = household.multi ? `<b>${household.nameOf(e.user_id)}</b> — ` : '';
    const subj = (e.suggested_payload as any)?.subject || (e.suggested_payload as any)?.from || e.suggested_action || e.category;
    lines.push(`• ${prefix}[${e.category}] ${subj}`);
  });
  return lines.join('\n');
}

// /overdue — open tasks whose due_date is in the past, across the household.
// DB-driven, no AI round-trip. Mirrors the /today layout.
async function handleOverdue(supabase: any, ids: string[], household: any): Promise<string> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase.from('tasks')
    .select('title, due_date, priority, user_id')
    .in('user_id', ids).eq('completed', false).eq('trashed', false)
    .lt('due_date', nowIso).order('due_date').limit(15);
  if (!data?.length) return '✅ Nothing overdue. Nice.';
  const lines = ['<b>⚠️ Overdue tasks</b>'];
  (data as any[]).forEach((t) => {
    const pr = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⚪️' : '🟡';
    const days = Math.max(1, Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000));
    const who = household.multi ? ` <i>(${household.nameOf(t.user_id)})</i>` : '';
    lines.push(`${pr} ${t.title}${who} — ${days}d late`);
  });
  return lines.join('\n');
}

// /notes <query> — ILIKE search across the household's notes (title + body).
async function handleNotesSearch(supabase: any, ids: string[], query: string): Promise<string> {
  const q = query.trim();
  if (!q) return 'Usage: <code>/notes &lt;search&gt;</code>';
  const { data } = await supabase.from('notes')
    .select('title, content, updated_at, user_id')
    .in('user_id', ids)
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order('updated_at', { ascending: false }).limit(8);
  if (!data?.length) return `🔍 No notes match "${q}".`;
  const lines = [`<b>📝 Notes matching "${q}"</b>`];
  (data as any[]).forEach((n: any) => {
    const snippet = String(n.content || '').replace(/\s+/g, ' ').slice(0, 120);
    lines.push(`• <b>${escapeHtml(n.title || 'Untitled')}</b>${snippet ? ` — ${escapeHtml(snippet)}…` : ''}`);
  });
  return lines.join('\n');
}

// /free [day] — find free slots for the *sender* (single user) in working hours.
async function handleFreeTime(supabase: any, userId: string, dayHint: string, tz?: string): Promise<string> {
  // Pull a duration token like "2h" / "90m" out of the hint, default 30 min.
  let durationMinutes = 30;
  const durMatch = dayHint.match(/(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)/i);
  if (durMatch) {
    const n = Number(durMatch[1]);
    durationMinutes = /^h/i.test(durMatch[2]) ? n * 60 : n;
    dayHint = dayHint.replace(durMatch[0], '').trim();
  }
  const slots = await findTimeSlots(supabase, {
    workspaceId: '',
    participants: [userId],
    durationMinutes,
    withinDays: 7,
    timezone: tz,
  });
  let ranked = rankProposedSlots(slots);
  const hint = dayHint.toLowerCase();
  // Lightweight day filter so "/free thursday" narrows to Thursday slots.
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
    thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
    today: -1, tomorrow: -2,
  };
  for (const [k, v] of Object.entries(dayMap)) {
    if (hint.includes(k)) {
      const target = v === -1 ? new Date().getDay() : v === -2 ? (new Date().getDay() + 1) % 7 : v;
      ranked = ranked.filter((s: any) => new Date(s.start).getDay() === target);
      break;
    }
  }
  ranked = ranked.slice(0, 5);
  if (!ranked.length) return `😕 No free ${durationMinutes}-minute slots${dayHint ? ` for "${dayHint}"` : ' in the next 7 days'}.`;
  const lines = [`<b>🗓 Free ${durationMinutes}-min slots</b>${dayHint ? ` (${escapeHtml(dayHint)})` : ''}`];
  ranked.forEach((s: any, i: number) => lines.push(`${i + 1}. ${s.local}`));
  return lines.join('\n');
}

// /draft <subject-fragment> — find the most recent inbound email matching the
// fragment and ask email-draft-reply to compose a reply.
async function handleEmailDraft(supabase: any, userId: string, query: string): Promise<string> {
  const q = query.trim();
  if (!q) return 'Usage: <code>/draft &lt;subject or sender&gt;</code>';
  const { data: matches } = await supabase.from('emails')
    .select('id, subject, from_address')
    .eq('user_id', userId)
    .or(`subject.ilike.%${q}%,from_address.ilike.%${q}%`)
    .order('received_at', { ascending: false }).limit(2);
  if (!matches?.length) return `🔍 No email matches "${q}".`;
  if (matches.length > 1) return `🤔 Multiple emails match "${q}":\n${matches.map((e: any, i: number) => `${i + 1}. ${e.subject || '(no subject)'} — ${e.from_address}`).join('\n')}\nBe more specific.`;
  const email = matches[0];
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/email-draft-reply`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_id: email.id, user_id: userId }),
    });
    const j = await r.json().catch(() => ({}));
    const draft = (j.draft || j.body || j.reply || '').toString().trim();
    if (!draft) return `⚠️ Couldn't draft a reply right now. Open the email in the app to draft it manually.`;
    return `<b>✉️ Draft reply to "${escapeHtml(email.subject || '(no subject)')}"</b>\n\n${escapeHtml(draft).slice(0, 3000)}\n\n<i>Open the app to review &amp; send.</i>`;
  } catch (e) {
    return `⚠️ Couldn't draft: ${(e as Error).message}`;
  }
}

async function handlePrayers(supabase: any, userId: string): Promise<string> {
  // Try invoking the prayer-times function; fall back gracefully.
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/prayer-times`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date: new Date().toISOString().slice(0, 10) }),
    });
    if (r.ok) {
      const j = await r.json();
      const times = j.times || j;
      if (times && typeof times === 'object') {
        const lines = ['<b>🕌 Today\'s prayer times</b>'];
        ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
          const v = times[k] || times[k.charAt(0).toUpperCase() + k.slice(1)];
          if (v) lines.push(`• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
        });
        if (lines.length > 1) return lines.join('\n');
      }
    }
  } catch (e) { console.error('prayers fetch failed', e); }
  return '🕌 Prayer times unavailable right now. Check the Islam tab in the app.';
}

// /dhikr <count> — log dhikr count for today (best-effort, falls back to ack-only).
async function handleDhikr(supabase: any, userId: string, arg: string): Promise<string> {
  const n = parseInt(arg.trim(), 10);
  const count = Number.isFinite(n) && n > 0 ? n : 33;
  // Best-effort write: try a generic mood_logs row tagged dhikr (works regardless
  // of whether a dedicated dhikr_log table exists).
  try {
    await supabase.from('mood_logs').insert({
      user_id: userId, mood_score: null, energy_score: null,
      context_tags: ['dhikr'], notes: `${count} dhikr`,
    });
  } catch (_) { /* table missing or strict — silent ack still fine */ }
  return `📿 Logged <b>${count}</b> dhikr. SubhanAllah 🤲`;
}

// /qibla [city] — return the Qibla bearing from the given city (or profile city).
async function handleQibla(supabase: any, userId: string, cityArg: string): Promise<string> {
  let city = cityArg.trim();
  let country = '';
  if (!city) {
    const { data: prof } = await supabase.from('profiles')
      .select('location_city, location_country').eq('user_id', userId).maybeSingle();
    city = prof?.location_city || '';
    country = prof?.location_country || '';
  }
  if (!city) return 'Usage: <code>/qibla &lt;city&gt;</code> — or set your city in your profile.';
  try {
    // Aladhan's qibla endpoint takes lat/long, so first geocode via timingsByCity.
    const dateStr = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
    const tUrl = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`;
    const tRes = await fetch(tUrl).then(r => r.json());
    const lat = tRes?.data?.meta?.latitude;
    const lng = tRes?.data?.meta?.longitude;
    if (lat == null || lng == null) return `🧭 Couldn't geolocate "${city}".`;
    const qRes = await fetch(`https://api.aladhan.com/v1/qibla/${lat}/${lng}`).then(r => r.json());
    const dir = qRes?.data?.direction;
    if (dir == null) return `🧭 Couldn't compute Qibla for "${city}".`;
    return `🧭 Qibla from <b>${city}</b>: <b>${Number(dir).toFixed(1)}°</b> from true north.`;
  } catch (e) {
    console.error('qibla error', e);
    return '🧭 Qibla service unavailable right now.';
  }
}

// /quran <surah> — minimal surah snippet via Aladhan's al-quran companion API.
async function handleQuran(supabase: any, userId: string, arg: string): Promise<string> {
  const q = arg.trim();
  if (!q) return 'Usage: <code>/quran &lt;surah name or number&gt;</code> (e.g. /quran al-fatiha or /quran 1)';
  void supabase; void userId;
  try {
    // Try numeric first; otherwise let user pick the famous short ones.
    const num = parseInt(q, 10);
    let surahNum = Number.isFinite(num) && num >= 1 && num <= 114 ? num : null;
    if (surahNum == null) {
      const aliases: Record<string, number> = {
        'al-fatiha': 1, 'fatiha': 1, 'fatihah': 1, 'al-fatihah': 1,
        'al-ikhlas': 112, 'ikhlas': 112, 'al-falaq': 113, 'falaq': 113,
        'an-nas': 114, 'nas': 114, 'al-nas': 114, 'al-kawthar': 108, 'kawthar': 108,
        'ya-sin': 36, 'yasin': 36, 'ya sin': 36, 'al-mulk': 67, 'mulk': 67,
        'al-kahf': 18, 'kahf': 18, 'al-baqarah': 2, 'baqarah': 2,
      };
      surahNum = aliases[q.toLowerCase()] ?? null;
    }
    if (surahNum == null) return `🕌 I don't recognise "${q}". Try a number 1-114 or a name like /quran al-fatiha.`;
    const r = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,en.sahih`);
    const j = await r.json();
    if (!j.data?.length) return '🕌 Quran service unavailable right now.';
    const arabic = j.data[0]; const english = j.data[1];
    const limit = arabic.numberOfAyahs <= 10 ? arabic.numberOfAyahs : 5;
    const lines = [`<b>📖 Surah ${arabic.englishName} — ${arabic.englishNameTranslation}</b>`];
    for (let i = 0; i < limit; i++) {
      lines.push(`\n<b>${i + 1}.</b> ${arabic.ayahs[i].text}`);
      lines.push(`<i>${english.ayahs[i].text}</i>`);
    }
    if (limit < arabic.numberOfAyahs) lines.push(`\n…and ${arabic.numberOfAyahs - limit} more verses (open in app for full surah).`);
    return lines.join('\n');
  } catch (e) {
    console.error('quran error', e);
    return '🕌 Quran service unavailable right now.';
  }
}

// /chores — recurring tasks tagged 'chore' across the household.
async function handleChores(supabase: any, ids: string[]): Promise<string> {
  const { data } = await supabase.from('tasks')
    .select('title, due_date, user_id, category')
    .in('user_id', ids).eq('completed', false)
    .or('category.eq.chore,category.eq.household,recurrence_rule.not.is.null')
    .order('due_date', { ascending: true, nullsFirst: false }).limit(15);
  if (!data?.length) return '🧹 No active chores. Tip: tag a recurring task with category="chore".';
  const lines = data.slice(0, 10).map((t: any) => {
    const when = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
    return `• ${t.title} <i>(${when})</i>`;
  });
  return `<b>🧹 Household chores</b>\n${lines.join('\n')}`;
}

async function handleToggleSetting(
  supabase: any, userId: string, column: string, value: boolean, label: string
): Promise<string> {
  const { error } = await supabase.from('proactive_settings')
    .upsert({ user_id: userId, [column]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return `⚠️ Could not update ${label}: ${error.message}`;
  return `✅ ${label} ${value ? 'enabled' : 'disabled'}.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { chat_id, text, telegram_user_id, telegram_first_name, telegram_username, workspace_id } = await req.json();

  // Resolve group → owner + partner
  const { data: group } = await supabase
    .from('telegram_group_links')
    .select('owner_user_id, partner_user_id')
    .eq('chat_id', chat_id).eq('is_active', true).maybeSingle();

  if (!group) {
    await tgSend(chat_id, '🔒 This group is not linked to a Dori family space yet.');
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  const household = await getHouseholdMembers(supabase, group.owner_user_id, group.partner_user_id);
  const memberIds = household.ids;

  // Resolve sender → app user
  let senderUserId: string | null = null;
  if (telegram_user_id) {
    const { data: mapped } = await supabase.from('telegram_user_map')
      .select('user_id').eq('telegram_user_id', telegram_user_id).maybeSingle();
    if (mapped) senderUserId = mapped.user_id;
  }
  const userForChat = senderUserId || group.owner_user_id;

  // Pull the caller's timezone so every formatted time in digests /
  // standups / recaps / scheduled slots is in their local clock, not UTC.
  let userTimezone: string | undefined;
  try {
    const { data: p } = await supabase.from('profiles').select('timezone').eq('user_id', userForChat).maybeSingle();
    userTimezone = p?.timezone || undefined;
  } catch { /* ignore */ }

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // ─── Confirmation shortcut: bare "yes/no" replies ────────
  // If the sender has a pending queued action from this chat, a plain
  // "yes"/"do it"/"no"/"cancel" resolves it without another AI round.
  const confirm = classifyConfirmationText(trimmed);
  if (confirm) {
    const chatSource = workspace_id ? 'tg_workspace' : 'tg_family';
    const pending = await fetchLatestPendingForChat(supabase, userForChat, chatSource, String(chat_id));
    if (pending) {
      const msg = confirm === 'yes'
        ? await approveAndExecutePending(supabase, pending, SUPABASE_URL, SERVICE_KEY)
        : await rejectPending(supabase, pending.id, pending.reason);
      await tgSend(chat_id, msg);
      try { await supabase.from('telegram_assistant_replies').insert({ chat_id, reply: msg }); } catch { /* ignore */ }
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
  }

  // ─── Help / discoverability ──────────────────────────────
  if (isHelpRequest(lower)) {
    await tgSend(chat_id, HELP_TEXT);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /me — personal digest, no AI round-trip ─────────────
  if (lower === '/me') {
    await tgSend(chat_id, await handleMeDigest(supabase, userForChat, workspace_id || null, userTimezone));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /plans — list active plans + per-plan inline keyboard ─
  if (lower === '/plans') {
    await handlePlansCommand(supabase, chat_id, userForChat);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /standup — per-member summary (workspace groups only) ─
  if (lower === '/standup') {
    if (!workspace_id) {
      await tgSend(chat_id, '🧑‍🤝‍🧑 /standup works in workspace-linked groups. Try /linkworkspace <code> first.');
    } else {
      await tgSend(chat_id, await handleStandup(supabase, workspace_id, userTimezone));
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /comment — post a comment on a workspace task ──────
  // Syntax: /comment <search-text> :: <comment body>
  // We split on '::' so the search can contain spaces. If no '::' is
  // given we treat the last ~80% of the text as the body once a single
  // unambiguous task match is found.
  if (lower.startsWith('/comment')) {
    if (!workspace_id) {
      await tgSend(chat_id, '💬 /comment only works in workspace-linked groups.');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const rest = trimmed.slice('/comment'.length).trim();
    if (!rest) {
      await tgSend(chat_id, 'Usage: <code>/comment &lt;task title&gt; :: &lt;your comment&gt;</code>');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const sep = rest.indexOf('::');
    let query = '';
    let body = '';
    if (sep >= 0) {
      query = rest.slice(0, sep).trim();
      body = rest.slice(sep + 2).trim();
    } else {
      // Naive split: first 4 words as search, rest as body. Works for
      // short titles like "pitch deck review".
      const parts = rest.split(/\s+/);
      query = parts.slice(0, Math.min(4, parts.length - 1)).join(' ');
      body = parts.slice(Math.min(4, parts.length - 1)).join(' ');
    }
    if (!query || !body) {
      await tgSend(chat_id, 'Usage: <code>/comment &lt;task title&gt; :: &lt;your comment&gt;</code>');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const { data: matches } = await supabase.from('tasks')
      .select('id, title').eq('workspace_id', workspace_id).eq('trashed', false)
      .ilike('title', `%${query}%`).order('updated_at', { ascending: false }).limit(3);
    if (!matches?.length) {
      await tgSend(chat_id, `🔍 No task matches "${query}" in this workspace.`);
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    if (matches.length > 1) {
      const opts = matches.map((m: any, i: number) => `${i + 1}. ${m.title}`).join('\n');
      await tgSend(chat_id, `🤔 Multiple tasks match "${query}":\n${opts}\n\nBe more specific.`);
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const task = matches[0];
    const { error } = await supabase.from('task_comments').insert({
      task_id: task.id, author_id: userForChat, body, source: 'tg_workspace',
    });
    if (error) {
      await tgSend(chat_id, `⚠️ Could not save comment: ${error.message}`);
    } else {
      await tgSend(chat_id, `💬 Commented on <b>${task.title}</b>.`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /recap — weekly team recap (workspace-linked groups only) ─
  if (lower === '/recap') {
    if (!workspace_id) {
      await tgSend(chat_id, '📦 /recap works in workspace-linked groups. Link first with /linkworkspace <code>.');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const [{ data: ws }, recap] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', workspace_id).maybeSingle(),
      buildWorkspaceWeeklyRecap(supabase, workspace_id, { timezone: userTimezone }),
    ]);
    await tgSend(chat_id, formatRecapForTelegram(recap, ws?.name, userTimezone));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── /schedule — find a time for the listed teammates ────
  // Format: /schedule <title> with @a @b for 30m
  if (lower.startsWith('/schedule ')) {
    if (!workspace_id) {
      await tgSend(chat_id, '🗓 /schedule works in workspace-linked groups. Link the group with /linkworkspace <code> first.');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    const body = trimmed.slice('/schedule '.length).trim();
    // Pull the @mentions and the duration off the end.
    const mentionRegex = /@([a-zA-Z0-9_\-]+)/g;
    const mentions = [...body.matchAll(mentionRegex)].map((m) => m[1]);
    const durMatch = body.match(/\bfor\s+(\d+)\s*(m(?:in)?|mins|minutes|h(?:r)?|hrs|hours)?/i);
    const durationMinutes = durMatch
      ? (durMatch[2]?.toLowerCase().startsWith('h') ? Number(durMatch[1]) * 60 : Number(durMatch[1]))
      : 30;
    const title = body
      .replace(/\bwith\s+@[\w\-]+(?:\s+@[\w\-]+)*/i, '')
      .replace(/\bfor\s+\d+\s*(m(?:in)?|mins|minutes|h(?:r)?|hrs|hours)?/i, '')
      .trim() || 'Meeting';

    if (mentions.length === 0) {
      await tgSend(chat_id, 'Usage: <code>/schedule &lt;title&gt; with @a @b for 30m</code>');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }

    // Resolve mentions against workspace members.
    const { data: wsMembers } = await supabase.from('workspace_members')
      .select('user_id, display_name').eq('workspace_id', workspace_id);
    const participantIds: string[] = [];
    const missing: string[] = [];
    for (const m of mentions) {
      const match = (wsMembers || []).find((x: any) => (x.display_name || '').toLowerCase() === m.toLowerCase());
      if (match) participantIds.push(match.user_id);
      else missing.push(m);
    }
    if (missing.length) {
      await tgSend(chat_id, `⚠️ These folks aren't in the workspace: ${missing.map((x) => `@${x}`).join(', ')}`);
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    // Include the sender themselves if they're a workspace member.
    if (senderUserId && !participantIds.includes(senderUserId)) {
      const selfIsMember = (wsMembers || []).some((x: any) => x.user_id === senderUserId);
      if (selfIsMember) participantIds.push(senderUserId);
    }

    const slots = await findTimeSlots(supabase, {
      workspaceId: workspace_id,
      participants: participantIds,
      durationMinutes,
      timezone: userTimezone,
    });
    const ranked = rankProposedSlots(slots).slice(0, 5);
    if (ranked.length === 0) {
      await tgSend(chat_id, `😕 No slot works for ${participantIds.length} people in the next week.`);
    } else {
      const lines = ranked.map((s, i) => `${i + 1}. ${s.local}`);
      await tgSend(chat_id, `<b>🗓 Slots for "${title}" (${durationMinutes}m)</b>\n${lines.join('\n')}\n\nReply with the number to book it.`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Undo most recent mutation ────────────────────────────
  if (lower === '/undo') {
    const entry = await fetchLatestUndoableForUser(supabase, userForChat);
    if (!entry) {
      await tgSend(chat_id, '⏰ Nothing to undo — the 5-minute window has passed or you haven\'t done anything yet.');
    } else {
      const res = await runUndo(supabase, entry, SUPABASE_URL, SERVICE_KEY);
      await tgSend(chat_id, res.message);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Schedule ────────────────────────────────────────────
  if (lower === '/today' || lower === '/agenda') {
    await sendTappableAgenda(chat_id, supabase, memberIds, 0, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/tomorrow') {
    await sendTappableAgenda(chat_id, supabase, memberIds, 1, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/week') {
    await tgSend(chat_id, await handleWeek(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (/^(show me the calendar|show calendar|what'?s on (my|our) calendar|what do (i|we) have (today|tomorrow|this week)|what are (my|our) next meetings|next meetings|upcoming meetings)[?!.]*$/i.test(trimmed)) {
    if (/meeting/i.test(trimmed)) {
      await tgSend(chat_id, await handleUpcomingMeetings(supabase, memberIds, household, userTimezone));
    } else if (/tomorrow/i.test(trimmed)) {
      await sendTappableAgenda(chat_id, supabase, memberIds, 1, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    } else if (/week/i.test(trimmed)) {
      await tgSend(chat_id, await handleWeek(supabase, memberIds, household));
    } else {
      await sendTappableAgenda(chat_id, supabase, memberIds, 0, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/shopping' || lower === '/list') {
    const sent = await sendTappableShoppingList(chat_id, supabase, group.owner_user_id, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    if (!sent) await tgSend(chat_id, '🛒 No active shopping lists.');
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Family & people ─────────────────────────────────────
  if (lower === '/birthdays') {
    await tgSend(chat_id, await handleBirthdays(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower.startsWith('/contacts')) {
    await tgSend(chat_id, await handleContacts(supabase, memberIds, trimmed.slice(9).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/linkme') {
    if (!telegram_user_id) {
      await tgSend(chat_id, 'Could not read your Telegram ID — try again.');
    } else {
      await supabase.from('telegram_user_map').upsert({
        telegram_user_id, user_id: group.owner_user_id,
        telegram_username: telegram_username || null,
        telegram_first_name: telegram_first_name || null,
      }, { onConflict: 'telegram_user_id' });
      await tgSend(chat_id, `✅ Linked Telegram ID <code>${telegram_user_id}</code> to this family space.`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Money & assets ──────────────────────────────────────
  if (lower === '/contracts' || lower === '/expiring') {
    const expiringOnly = lower === '/expiring';
    let q = supabase.from('contracts')
      .select('id, name, provider, cost_amount, cost_frequency, renewal_date, end_date, user_id')
      .in('user_id', memberIds).eq('is_active', true);
    if (expiringOnly) {
      const in60 = new Date(); in60.setDate(in60.getDate() + 60);
      q = q.or(`renewal_date.lte.${in60.toISOString().slice(0, 10)},end_date.lte.${in60.toISOString().slice(0, 10)}`);
    }
    const { data: rows } = await q.order('renewal_date', { nullsFirst: false }).limit(12);
    if (!rows?.length) {
      await tgSend(chat_id, expiringOnly ? '✅ Nothing expiring in the next 60 days.' : '📄 No active contracts.');
      return new Response('{"ok":true}', { headers: corsHeaders });
    }
    await tgSend(chat_id, `<b>${expiringOnly ? '⏳ Expiring soon (60 days)' : '📄 Active contracts'}</b> — tap for options`);
    for (const c of rows) {
      const cost = c.cost_amount ? ` — ${c.cost_amount}€${c.cost_frequency ? '/' + c.cost_frequency : ''}` : '';
      const due = c.renewal_date || c.end_date;
      const when = due ? ` (until ${new Date(due).toLocaleDateString('en-GB')})` : '';
      const line = `• <b>${c.name}</b>${c.provider ? ` — ${c.provider}` : ''}${cost}${when}`;
      await tgSendWithKeyboard(chat_id, line, buildContractRowKeyboard(c.id), LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/properties') {
    await tgSend(chat_id, await handleProperties(supabase, memberIds));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/vehicles') {
    await tgSend(chat_id, await handleVehicles(supabase, memberIds));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Health & wellbeing ──────────────────────────────────
  if (lower === '/health') {
    await tgSend(chat_id, await handleHealth(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/checkin' || lower === '/mood') {
    await tgSend(chat_id, await handleCheckin(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Email ───────────────────────────────────────────────
  if (lower === '/inbox') {
    await tgSend(chat_id, await handleEmailActions(supabase, memberIds, household, true));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/actions') {
    await tgSend(chat_id, await handleEmailActions(supabase, memberIds, household, false));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower.startsWith('/draft')) {
    await tgSend(chat_id, await handleEmailDraft(supabase, userForChat, trimmed.slice(6).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Tasks / notes / free-time shortcuts ────────────────
  if (lower === '/overdue') {
    await tgSend(chat_id, await handleOverdue(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /done — what was completed since Monday
  if (lower === '/done') {
    const now = new Date(); const dow = now.getDay(); const offset = (dow + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - offset); monday.setHours(0,0,0,0);
    const { data } = await supabase.from('tasks')
      .select('title, updated_at, user_id')
      .in('user_id', memberIds).eq('completed', true).eq('trashed', false)
      .gte('updated_at', monday.toISOString())
      .order('updated_at', { ascending: false }).limit(20);
    if (!data?.length) {
      await tgSend(chat_id, '📭 Nothing completed yet this week.');
    } else {
      const lines = ['<b>✅ Completed this week</b>'];
      (data as any[]).forEach((t: any) => {
        const who = household.multi ? ` <i>(${household.nameOf(t.user_id)})</i>` : '';
        lines.push(`• ${escapeHtml(t.title)}${who}`);
      });
      await tgSend(chat_id, lines.join('\n'));
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /snooze — push all of today's open tasks to tomorrow
  if (lower === '/snooze') {
    const t0 = new Date(); t0.setHours(0,0,0,0); const t1 = new Date(t0); t1.setDate(t1.getDate()+1);
    const { data: rows } = await supabase.from('tasks')
      .select('id, due_date').eq('user_id', userForChat).eq('completed', false)
      .gte('due_date', t0.toISOString()).lt('due_date', t1.toISOString());
    if (!rows?.length) {
      await tgSend(chat_id, '📭 No open tasks today.');
    } else {
      await Promise.all((rows as any[]).map((r: any) => {
        const d = new Date(r.due_date); d.setDate(d.getDate()+1);
        return supabase.from('tasks').update({ due_date: d.toISOString() }).eq('id', r.id).eq('user_id', userForChat);
      }));
      await tgSend(chat_id, `💤 Snoozed ${rows.length} task${rows.length === 1 ? '' : 's'} to tomorrow.`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /load — meeting hours this week
  if (lower === '/load') {
    const now = new Date(); const dow = now.getDay(); const offset = (dow + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - offset); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+7);
    const { data } = await supabase.from('events')
      .select('start_time, end_time, user_id')
      .in('user_id', memberIds)
      .gte('start_time', monday.toISOString()).lt('start_time', sunday.toISOString());
    if (!data?.length) { await tgSend(chat_id, '📭 No meetings this week.'); return new Response('{"ok":true}', { headers: corsHeaders }); }
    const totals: Record<string, number> = {};
    (data as any[]).forEach((e: any) => {
      const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
      const hrs = Math.max(0, ms / 3600000);
      totals[e.user_id] = (totals[e.user_id] || 0) + hrs;
    });
    const lines = ['<b>📆 Meeting load this week</b>'];
    Object.entries(totals).forEach(([uid, hrs]) => lines.push(`• ${escapeHtml(household.nameOf(uid))}: ${hrs.toFixed(1)}h`));
    await tgSend(chat_id, lines.join('\n'));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /agenda <YYYY-MM-DD> — past or future date
  if (lower.startsWith('/agenda ')) {
    const arg = trimmed.slice(8).trim();
    const date = new Date(arg);
    if (isNaN(date.getTime())) {
      await tgSend(chat_id, 'Usage: <code>/agenda YYYY-MM-DD</code>');
    } else {
      const d0 = new Date(date); d0.setHours(0,0,0,0); const d1 = new Date(d0); d1.setDate(d1.getDate()+1);
      const [{ data: events }, { data: tasks }] = await Promise.all([
        supabase.from('events').select('title, start_time, location, user_id')
          .in('user_id', memberIds)
          .gte('start_time', d0.toISOString()).lt('start_time', d1.toISOString())
          .order('start_time'),
        supabase.from('tasks').select('title, user_id, completed')
          .in('user_id', memberIds).eq('trashed', false)
          .gte('due_date', d0.toISOString()).lt('due_date', d1.toISOString()),
      ]);
      const lines = [`<b>📅 ${arg}</b>`];
      if (events?.length) {
        lines.push('\n<b>Events</b>');
        (events as any[]).forEach((e: any) => {
          const t = new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          lines.push(`• ${t} — ${escapeHtml(e.title)}${e.location ? ` @ ${escapeHtml(e.location)}` : ''}`);
        });
      }
      if (tasks?.length) {
        lines.push('\n<b>Tasks</b>');
        (tasks as any[]).forEach((t: any) => lines.push(`${t.completed ? '✅' : '⬜'} ${escapeHtml(t.title)}`));
      }
      if (!events?.length && !tasks?.length) lines.push('\n📭 Nothing scheduled.');
      await tgSend(chat_id, lines.join('\n'));
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /menu — today's planned meal
  if (lower === '/menu') {
    const today = new Date().toISOString().slice(0,10);
    const { data } = await supabase.from('meal_plans')
      .select('meal_type, custom_meal_name, recipe_id, recipes(name)')
      .in('user_id', memberIds).eq('meal_date', today).order('meal_type');
    if (!data?.length) {
      await tgSend(chat_id, '🍽 No meals planned for today. Plan one in the Cooking hub.');
    } else {
      const lines = ['<b>🍽 Today\'s menu</b>'];
      (data as any[]).forEach((m: any) => {
        const name = m.custom_meal_name || m.recipes?.name || '(untitled)';
        lines.push(`• ${m.meal_type}: ${escapeHtml(name)}`);
      });
      await tgSend(chat_id, lines.join('\n'));
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /expense <amount> [category] [note...]
  if (lower.startsWith('/expense ') || lower === '/expense') {
    const rest = trimmed.slice(8).trim();
    const tokens = rest.split(/\s+/);
    const amount = Number(tokens[0]?.replace(',', '.').replace(/[€$]/g, ''));
    if (!Number.isFinite(amount)) {
      await tgSend(chat_id, 'Usage: <code>/expense 23.50 food lunch with Sarah</code>');
    } else {
      const category = tokens[1] || 'misc';
      const note = tokens.slice(2).join(' ') || category;
      const { data: row, error } = await supabase.from('family_expenses').insert({
        user_id: userForChat, amount, description: `${category} · ${note}`,
        expense_date: new Date().toISOString().slice(0,10),
      }).select('id').single();
      if (error) await tgSend(chat_id, `⚠️ Could not log: ${error.message}`);
      else await tgSend(chat_id, `💶 Logged €${amount.toFixed(2)} — ${escapeHtml(category)}`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /spent [category] [period]
  if (lower === '/spent' || lower.startsWith('/spent ')) {
    const args = trimmed.slice(6).trim().split(/\s+/).filter(Boolean);
    const periods = new Set(['today', 'week', 'month', 'year']);
    let period = 'month'; let category = '';
    args.forEach((a) => { if (periods.has(a.toLowerCase())) period = a.toLowerCase(); else category = a; });
    const since = new Date();
    if (period === 'today') since.setHours(0,0,0,0);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'year') since.setFullYear(since.getFullYear() - 1);
    else since.setMonth(since.getMonth() - 1);
    let q = supabase.from('family_expenses').select('amount, description')
      .in('user_id', memberIds).gte('expense_date', since.toISOString().slice(0,10));
    if (category) q = q.ilike('description', `%${category}%`);
    const { data } = await q;
    const total = (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    await tgSend(chat_id, `💶 Spent <b>€${total.toFixed(2)}</b>${category ? ` on "${escapeHtml(category)}"` : ''} in past ${period} (${data?.length || 0} items).`);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /weather [city]
  if (lower === '/weather' || lower.startsWith('/weather ')) {
    const city = trimmed.slice(8).trim();
    if (!city) { await tgSend(chat_id, 'Usage: <code>/weather Berlin</code>'); return new Response('{"ok":true}', { headers: corsHeaders }); }
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then(r => r.json());
      const place = geo?.results?.[0];
      if (!place) { await tgSend(chat_id, `🌍 Couldn't find "${escapeHtml(city)}".`); return new Response('{"ok":true}', { headers: corsHeaders }); }
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=2`).then(r => r.json());
      const lines = [`🌤 <b>${escapeHtml(place.name)}, ${place.country_code}</b>`];
      ['Today','Tomorrow'].forEach((label, i) => {
        const hi = w?.daily?.temperature_2m_max?.[i];
        const lo = w?.daily?.temperature_2m_min?.[i];
        const rain = w?.daily?.precipitation_sum?.[i];
        if (hi != null) lines.push(`${label}: ${lo}°–${hi}°C, ${rain ?? 0}mm`);
      });
      await tgSend(chat_id, lines.join('\n'));
    } catch (e) {
      await tgSend(chat_id, `⚠️ Weather lookup failed: ${(e as Error).message}`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /lang de|en
  const langMatch = lower.match(/^\/lang\s+(de|en)$/);
  if (langMatch) {
    await supabase.from('profiles').update({ locale: langMatch[1] }).eq('user_id', userForChat);
    await tgSend(chat_id, langMatch[1] === 'de' ? '🇩🇪 Sprache auf Deutsch gestellt.' : '🇬🇧 Language set to English.');
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /recent — last 5 mutations
  if (lower === '/recent') {
    let rows: any[] = [];
    const labelTry = await supabase.from('dori_undo_log')
      .select('label, created_at').eq('user_id', userForChat)
      .order('created_at', { ascending: false }).limit(5);
    if (!labelTry.error && labelTry.data) rows = labelTry.data as any[];
    else {
      const { data: alt } = await supabase.from('dori_undo_log')
        .select('action, payload, created_at').eq('user_id', userForChat)
        .order('created_at', { ascending: false }).limit(5);
      rows = (alt || []).map((r: any) => ({ label: r?.payload?.label || r?.action || 'action', created_at: r.created_at }));
    }
    if (!rows.length) {
      await tgSend(chat_id, '📭 No recent actions.');
    } else {
      const lines = ['<b>🕓 Recent actions</b>'];
      rows.forEach((r: any, i: number) => {
        const mins = Math.max(1, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000));
        lines.push(`${i + 1}. ${escapeHtml(r.label)} <i>(${mins}m ago)</i>`);
      });
      await tgSend(chat_id, lines.join('\n'));
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // /whoseturn <chore name>
  if (lower.startsWith('/whoseturn')) {
    const q = trimmed.slice(10).trim();
    if (!q) {
      await tgSend(chat_id, 'Usage: <code>/whoseturn trash</code>');
    } else {
      const { data: chores } = await supabase.from('family_chores')
        .select('id, title, rotation_members, family_member_id, last_completed_at')
        .in('user_id', memberIds).eq('is_active', true)
        .ilike('title', `%${q}%`).limit(1);
      if (!chores?.length) {
        await tgSend(chat_id, `🔍 No chore matches "${escapeHtml(q)}".`);
      } else {
        const c = chores[0];
        const rotation: string[] = Array.isArray(c.rotation_members) ? c.rotation_members : [];
        if (!rotation.length) {
          await tgSend(chat_id, `🧹 <b>${escapeHtml(c.title)}</b> — no rotation set; assigned to ${c.family_member_id || 'no one'}.`);
        } else {
          // Last completer index → next is +1 mod len
          const { data: last } = await supabase.from('family_chore_completions')
            .select('family_member_id').eq('chore_id', c.id)
            .order('completed_at', { ascending: false }).limit(1);
          const lastIdx = last?.[0]?.family_member_id ? rotation.indexOf(last[0].family_member_id) : -1;
          const nextId = rotation[(lastIdx + 1) % rotation.length];
          const { data: fm } = await supabase.from('family_members').select('name').eq('id', nextId).maybeSingle();
          await tgSend(chat_id, `🧹 <b>${escapeHtml(c.title)}</b> — next up: <b>${escapeHtml(fm?.name || 'Member')}</b>`);
        }
      }
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  if (lower.startsWith('/notes')) {
    await tgSend(chat_id, await handleNotesSearch(supabase, memberIds, trimmed.slice(6).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/free' || lower.startsWith('/free ')) {
    await tgSend(chat_id, await handleFreeTime(supabase, userForChat, trimmed.slice(5).trim(), userTimezone));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Islam ───────────────────────────────────────────────
  if (lower === '/prayers') {
    await tgSend(chat_id, await handlePrayers(supabase, userForChat));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/dhikr' || lower.startsWith('/dhikr ')) {
    await tgSend(chat_id, await handleDhikr(supabase, userForChat, trimmed.slice(6).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/qibla' || lower.startsWith('/qibla ')) {
    await tgSend(chat_id, await handleQibla(supabase, userForChat, trimmed.slice(6).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower.startsWith('/quran')) {
    await tgSend(chat_id, await handleQuran(supabase, userForChat, trimmed.slice(6).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/chores') {
    await tgSend(chat_id, await handleChores(supabase, memberIds));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Settings toggles ────────────────────────────────────
  const quietMatch = lower.match(/^\/quiet\s+(on|off)$/);
  if (quietMatch) {
    await tgSend(chat_id, await handleToggleSetting(
      supabase, userForChat, 'quiet_hours_enabled', quietMatch[1] === 'on', 'Quiet hours'));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  const voiceMatch = lower.match(/^\/voice\s+(on|off)$/);
  if (voiceMatch) {
    await tgSend(chat_id, await handleToggleSetting(
      supabase, userForChat, 'prefer_voice_replies', voiceMatch[1] === 'on', 'Voice replies'));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Force-route shortcuts ───────────────────────────────
  let forcedPrefix: string | null = null;
  let payloadText = trimmed;
  if (lower.startsWith('/add ')) { forcedPrefix = 'Add task: '; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/buy ')) { forcedPrefix = 'Add to shopping: '; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/event ')) { forcedPrefix = 'Create event: '; payloadText = trimmed.slice(7); }
  else if (lower.startsWith('/note ')) { forcedPrefix = 'Save note: '; payloadText = trimmed.slice(6); }
  else if (lower.startsWith('/remind ')) { forcedPrefix = 'Set reminder: '; payloadText = trimmed.slice(8); }
  // Phase 4: gap-closure shortcuts → chat function will pick the right tool
  else if (lower === '/budget' || lower.startsWith('/budget ')) { forcedPrefix = 'Budget: '; payloadText = trimmed.slice(7).trim() || 'list'; }
  else if (lower === '/period' || lower.startsWith('/period ')) { forcedPrefix = 'Log period: '; payloadText = trimmed.slice(7).trim() || 'today'; }
  else if (lower === '/meds' || lower.startsWith('/meds ')) { forcedPrefix = 'Log medication: '; payloadText = trimmed.slice(5).trim() || 'list'; }
  else if (lower === '/pantry' || lower.startsWith('/pantry ')) { forcedPrefix = 'Pantry: '; payloadText = trimmed.slice(7).trim() || 'list'; }
  else if (lower === '/fasting' || lower.startsWith('/fasting ')) { forcedPrefix = 'Fasting: '; payloadText = trimmed.slice(8).trim() || 'status'; }
  else if (lower.startsWith('/flight ')) { forcedPrefix = 'Track flight: '; payloadText = trimmed.slice(8); }
  else if (lower === '/status' || lower.startsWith('/status ')) { forcedPrefix = 'Set my presence to: '; payloadText = trimmed.slice(7).trim() || 'home'; }
  else if (lower.startsWith('/zakat ')) { forcedPrefix = 'Calculate Zakat on: '; payloadText = trimmed.slice(7); }
  else if (lower.startsWith('/tz ')) { forcedPrefix = 'What time is it in: '; payloadText = trimmed.slice(4); }
  else if (lower.startsWith('/fx ')) { forcedPrefix = 'Convert currency: '; payloadText = trimmed.slice(4); }
  else if (lower === '/summary' || lower.startsWith('/summary')) { forcedPrefix = 'Summarise unread emails'; payloadText = ''; }
  else if (lower.startsWith('/subtask ')) { forcedPrefix = 'Add subtask: '; payloadText = trimmed.slice(9); }
  else if (lower.startsWith('/tag ')) { forcedPrefix = 'Tag task: '; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/estimate ')) { forcedPrefix = 'Estimate task: '; payloadText = trimmed.slice(10); }

  // Build short conversation history (6h window, capped at 20 turns each side
  // → keeps Dori coherent across longer pauses without blowing the prompt).
  const sinceIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const [{ data: priorUserMsgs }, { data: priorReplies }] = await Promise.all([
    supabase.from('telegram_messages').select('text, created_at')
      .eq('chat_id', chat_id).gte('created_at', sinceIso).not('text', 'is', null)
      .order('created_at', { ascending: true }).limit(20),
    supabase.from('telegram_assistant_replies').select('reply, created_at')
      .eq('chat_id', chat_id).gte('created_at', sinceIso)
      .order('created_at', { ascending: true }).limit(20),
  ]);

  type Turn = { role: 'user' | 'assistant'; content: string; ts: number };
  const turns: Turn[] = [];
  (priorUserMsgs || []).forEach((m: any) => {
    if (m.text && m.text.trim() && m.text.trim() !== trimmed) {
      turns.push({ role: 'user', content: m.text, ts: new Date(m.created_at).getTime() });
    }
  });
  (priorReplies || []).forEach((r: any) => {
    if (r.reply) turns.push({ role: 'assistant', content: r.reply, ts: new Date(r.created_at).getTime() });
  });
  turns.sort((a, b) => a.ts - b.ts);
  const recent = turns.slice(-12);

  const finalUserContent = forcedPrefix ? `${forcedPrefix}${payloadText}` : trimmed;
  const conversationMessages = [
    ...recent.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: finalUserContent },
  ];

  try {
    const channel = workspace_id ? 'tg_workspace' : 'tg_family';
    const r = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userForChat,
        'x-dori-channel': channel,
        'x-dori-channel-ref': String(chat_id),
      },
      body: JSON.stringify({
        messages: conversationMessages,
        personality: 'balanced',
        executeServerSide: true,
        actionSource: channel,
        actionSourceRef: String(chat_id),
        workspaceId: workspace_id || undefined,
      }),
    });

    if (!r.ok) {
      await tgSend(chat_id, "Sorry, I couldn't reach Dori right now.");
      return new Response('{"ok":true}', { headers: corsHeaders });
    }

    const json = await r.json();
    const reply = (json.reply || '').trim();
    const toolResults = (json.toolResults || []) as {
      ok: boolean; message: string; queued?: boolean; actionId?: string; summary?: string;
      undoId?: string;
    }[];

    // Queued actions are rendered separately, each with its own inline keyboard
    // so the user can tap ✅ / ❌. Non-queued results are concatenated as a single reply.
    const queued = toolResults.filter(t => t.queued && t.actionId);
    const executed = toolResults.filter(t => !t.queued);

    const parts: string[] = [];
    if (reply) parts.push(reply);
    if (executed.length > 0) parts.push(executed.map(t => t.message).join('\n'));
    const finalMsg = parts.join('\n\n').trim();

    const undoableIds = executed.map((t) => t.undoId).filter(Boolean) as string[];
    const latestUndoId = undoableIds.length > 0 ? undoableIds[undoableIds.length - 1] : null;

    if (finalMsg) {
      try {
        await supabase.from('telegram_assistant_replies').insert({ chat_id, reply: finalMsg });
      } catch (e) { console.error('Failed to persist assistant reply', e); }

      let preferVoice = false;
      let voiceLocale: string | undefined;
      try {
        const prefUser = senderUserId || group.owner_user_id;
        const [{ data: ps }, { data: prof }] = await Promise.all([
          supabase.from('proactive_settings').select('prefer_voice_replies').eq('user_id', prefUser).maybeSingle(),
          supabase.from('profiles').select('locale').eq('user_id', prefUser).maybeSingle(),
        ]);
        preferVoice = !!ps?.prefer_voice_replies;
        voiceLocale = prof?.locale || undefined;
      } catch (_) { /* ignore */ }

      if (latestUndoId && !preferVoice) {
        await tgSendWithKeyboard(
          chat_id,
          finalMsg.slice(0, 4000),
          buildUndoKeyboard(latestUndoId),
          LOVABLE_API_KEY,
          TELEGRAM_API_KEY,
        );
      } else {
        await sendDoriReply({
          chatId: chat_id, text: finalMsg.slice(0, 4000), preferVoice, locale: voiceLocale,
          lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
        });
        if (latestUndoId) {
          await tgSendWithKeyboard(
            chat_id,
            '↩️ Tap to undo the last action.',
            buildUndoKeyboard(latestUndoId),
            LOVABLE_API_KEY,
            TELEGRAM_API_KEY,
          );
        }
      }
    }

    for (const q of queued) {
      const prompt = `🤔 <b>Please confirm</b>\n${q.summary || q.message}\n\nReply <b>yes</b> or tap a button below.`;
      await tgSendWithKeyboard(
        chat_id,
        prompt,
        buildConfirmKeyboard(q.actionId!),
        LOVABLE_API_KEY,
        TELEGRAM_API_KEY,
      );
      try {
        await supabase.from('telegram_assistant_replies').insert({ chat_id, reply: prompt });
      } catch { /* ignore */ }
    }

    // If there was nothing to say AND nothing queued, keep the old "got it" behaviour.
    if (!finalMsg && queued.length === 0) {
      await tgSend(chat_id, 'Got it.');
    }

    return new Response('{"ok":true}', { headers: corsHeaders });
  } catch (e) {
    console.error('router error', e);
    await tgSend(chat_id, '⚠️ Something went wrong.');
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { headers: corsHeaders });
  }
});
