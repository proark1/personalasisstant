// Builds the shared "next N important things" digest for a Telegram family
// group. Used by /digest in telegram-router and the daily morning cron in
// telegram-family-morning-digest.

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface DigestHousehold {
  ids: string[];
  nameOf: (uid: string) => string;
  multi: boolean;
}

export interface DigestOpts {
  limit?: number;
  tz?: string;
  horizonDays?: number;
  greeting?: boolean;
}

export async function buildSharedFamilyDigest(
  supabase: any,
  ids: string[],
  household: DigestHousehold,
  opts: DigestOpts = {},
): Promise<string> {
  const limit = opts.limit ?? 7;
  const tz = opts.tz;
  const horizonDays = opts.horizonDays ?? 14;
  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() + horizonDays); end.setHours(23, 59, 59, 999);

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events')
      .select('id, title, start_time, location, user_id')
      .in('user_id', ids)
      .gte('start_time', now.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time')
      .limit(50),
    supabase.from('tasks')
      .select('id, title, due_date, priority, user_id')
      .in('user_id', ids)
      .eq('completed', false)
      .eq('trashed', false)
      .not('due_date', 'is', null)
      .gte('due_date', now.toISOString())
      .lte('due_date', end.toISOString())
      .order('due_date')
      .limit(50),
  ]);

  type Item = { when: Date; kind: 'event' | 'task'; title: string; location?: string | null; user_id: string; priority?: string | null };
  const items: Item[] = [];
  (events || []).forEach((e: any) => items.push({ when: new Date(e.start_time), kind: 'event', title: e.title, location: e.location, user_id: e.user_id }));
  (tasks || []).forEach((t: any) => items.push({ when: new Date(t.due_date), kind: 'task', title: t.title, user_id: t.user_id, priority: t.priority }));

  items.sort((a, b) => {
    const at = a.when.getTime();
    const bt = b.when.getTime();
    if (at !== bt) return at - bt;
    const pa = a.priority === 'high' ? -1 : 0;
    const pb = b.priority === 'high' ? -1 : 0;
    return pa - pb;
  });

  const top = items.slice(0, limit);

  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const dayLabel = (d: Date) => {
    const k = dayKey(d);
    if (k === todayKey) return 'Today';
    if (k === tomorrowKey) return 'Tomorrow';
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: '2-digit', month: 'short' }).format(d);
  };
  const timeLabel = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);

  const lines: string[] = [];
  if (opts.greeting) {
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10);
    const greet = hour < 12 ? '☀️ Good morning' : hour < 18 ? '👋 Good afternoon' : '🌙 Good evening';
    lines.push(`<b>${greet}, family!</b>`);
    lines.push(`Here's what's coming up in the next ${horizonDays} days:`);
  } else {
    lines.push(`<b>📅 Next ${top.length} for the family</b>`);
  }

  if (top.length === 0) {
    lines.push('\n✨ Nothing scheduled — enjoy the open calendar!');
    lines.push('\n<i>Add something with</i> <code>/event Dentist Tue 14:00</code> <i>or</i> <code>/add Pick up parcel tomorrow</code>');
    return lines.join('\n');
  }

  let currentDay = '';
  for (const it of top) {
    const k = dayKey(it.when);
    if (k !== currentDay) {
      currentDay = k;
      lines.push(`\n<b>${dayLabel(it.when)}</b>`);
    }
    const who = household.multi ? ` <i>(${household.nameOf(it.user_id)})</i>` : '';
    if (it.kind === 'event') {
      lines.push(`• 🗓 ${timeLabel(it.when)} — ${escapeHtml(it.title)}${it.location ? ` @ ${escapeHtml(it.location)}` : ''}${who}`);
    } else {
      const dot = it.priority === 'high' ? '🔴' : it.priority === 'low' ? '⚪️' : '🟡';
      lines.push(`• ${dot} ${escapeHtml(it.title)}${who}`);
    }
  }

  lines.push(`\n<i>Add fast:</i> <code>/event Title @ Fri 18:00</code> · <code>/add Buy gift tomorrow</code> · <code>/week</code> for full view`);
  return lines.join('\n');
}
