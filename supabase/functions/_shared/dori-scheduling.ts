// Simple "find a time that works for everyone" engine.
//
// Given a workspace id and a set of participant user ids + a duration,
// pull the busy blocks across everyone for the next N days, intersect
// with working hours, and return a ranked list of open slots. No
// timezone heroics for v1 — we operate in the caller's local time
// and assume the workspace shares a rough window.

interface BusyInterval { start: number; end: number; } // unix ms

export interface ProposedSlot {
  start: string;   // ISO
  end: string;     // ISO
  weekday: string; // "Mon", "Tue"…
  local: string;   // "Tue 24 Apr, 14:00–14:30"
}

export interface FindTimeInput {
  workspaceId: string;
  participants: string[];       // user_ids
  durationMinutes: number;
  withinDays?: number;          // default 7
  workStartHour?: number;       // hour in `timezone`, default 9
  workEndHour?: number;         // hour in `timezone`, default 18
  stepMinutes?: number;         // granularity, default 30
  timezone?: string;            // IANA tz; edge runtime is UTC so without
                                // this we'd propose 09:00 UTC as "morning"
                                // which is wrong for anyone east of London.
}

// The hour-of-day (0-23) for `ms` as seen in `tz`.
function hourIn(ms: number, tz?: string): number {
  if (!tz) return new Date(ms).getHours();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', hour12: false,
  }).formatToParts(new Date(ms));
  const h = parts.find((p) => p.type === 'hour')?.value;
  // "24" can leak out in some locales for midnight — treat as 0.
  return h ? (Number(h) % 24) : 0;
}

// Minimal Supabase client surface needed by this module.
type SchedulingClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

export async function findTimeSlots(
  supabase: SchedulingClient,
  input: FindTimeInput,
): Promise<ProposedSlot[]> {
  const {
    workspaceId: _workspaceId,
    participants,
    durationMinutes,
    withinDays = 7,
    workStartHour = 9,
    workEndHour = 18,
    stepMinutes = 30,
    timezone,
  } = input;
  if (!participants.length || durationMinutes <= 0) return [];

  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + withinDays * 24 * 60 * 60 * 1000);

  // Pull every relevant event for the participants in the window. We include
  // events in both the workspace and their personal calendars so Dori doesn't
  // propose a slot that collides with someone's private dentist appointment.
  const { data: rows } = await supabase
    .from('events')
    .select('start_time, end_time, user_id, assignee_id, workspace_id')
    .in('user_id', participants)
    .gte('end_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString());

  // Build a busy list per user.
  const busy = new Map<string, BusyInterval[]>();
  for (const p of participants) busy.set(p, []);
  for (const ev of (rows || [])) {
    const starter = ev.user_id as string;
    const assignee = (ev.assignee_id as string) || null;
    // Event owner is busy. If it has an assignee who's different, they're busy too.
    for (const uid of new Set([starter, assignee].filter(Boolean) as string[])) {
      const list = busy.get(uid);
      if (!list) continue;
      list.push({ start: new Date(ev.start_time).getTime(), end: new Date(ev.end_time).getTime() });
    }
  }
  for (const list of busy.values()) list.sort((a, b) => a.start - b.start);

  // Walk the whole window in step-minute increments and accept slots whose
  // starting hour (seen in the user's tz) falls inside working hours AND
  // where everybody is free for the full duration. Walking in UTC keeps
  // us DST-correct without dragging in a tz library.
  const stepMs = stepMinutes * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;
  const out: ProposedSlot[] = [];
  const now = Date.now();

  for (let cursor = windowStart.getTime(); cursor + durationMs <= windowEnd.getTime(); cursor += stepMs) {
    if (cursor < now) continue;
    const slotHour = hourIn(cursor, timezone);
    if (slotHour < workStartHour || slotHour >= workEndHour) continue;

    const slotStart = cursor;
    const slotEnd = cursor + durationMs;
    let allFree = true;
    for (const [, intervals] of busy) {
      for (const iv of intervals) {
        if (iv.end <= slotStart) continue;
        if (iv.start >= slotEnd) break;
        allFree = false;
        break;
      }
      if (!allFree) break;
    }
    if (allFree) {
      const s = new Date(slotStart);
      const e = new Date(slotEnd);
      const dateFmt: Intl.DateTimeFormatOptions = { timeZone: timezone, weekday: 'short', day: '2-digit', month: 'short' };
      const timeFmt: Intl.DateTimeFormatOptions = { timeZone: timezone, hour: '2-digit', minute: '2-digit' };
      out.push({
        start: s.toISOString(),
        end: e.toISOString(),
        weekday: s.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'short' }),
        local: `${s.toLocaleDateString('en-GB', dateFmt)}, ${s.toLocaleTimeString('en-GB', timeFmt)}–${e.toLocaleTimeString('en-GB', timeFmt)}`,
      });
      // Skip overlapping neighbours and cap to ~2 per day by jumping past
      // the chosen slot's end.
      cursor += durationMs - stepMs;
      if (out.length >= 10) break;
    }
  }

  return out.slice(0, 5);
}

// Simple heuristic to rank proposals: prefer morning slots (9–12) on
// weekdays, then afternoon, then close to the request time.
export function rankProposedSlots(slots: ProposedSlot[]): ProposedSlot[] {
  return [...slots].sort((a, b) => {
    const aDate = new Date(a.start);
    const bDate = new Date(b.start);
    const aScore = (aDate.getHours() >= 9 && aDate.getHours() < 12 ? -2 : 0) + aDate.getTime() / 1e10;
    const bScore = (bDate.getHours() >= 9 && bDate.getHours() < 12 ? -2 : 0) + bDate.getTime() / 1e10;
    return aScore - bScore;
  });
}
