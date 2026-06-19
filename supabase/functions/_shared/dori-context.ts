// Dori context engine.
//
// One call, one compact snapshot of "what is this user working on right now",
// so the assistant can answer in one AI round without juggling 6 different
// lookups inside the prompt. Shared between the chat function, the /me
// digest, and the weekly-recap generator so they all see the same picture.

export interface DoriCtxTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  completed: boolean;
  assignee_id: string | null;
  workspace_id: string | null;
}

export interface DoriCtxEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  assignee_id: string | null;
  workspace_id: string | null;
}

export interface DoriCtxMember {
  user_id: string;
  display_name: string | null;
  role: string;
}

export interface DoriContext {
  scope: "personal" | "workspace";
  workspaceId: string | null;
  now: string; // ISO timestamp
  timezone: string | undefined;
  openTasks: DoriCtxTask[]; // up to 20 most-relevant (overdue → today → soonest)
  overdueCount: number;
  todayEvents: DoriCtxEvent[];
  tomorrowEvents: DoriCtxEvent[];
  thisWeekEventCount: number;
  recentCompletedCount: number; // completed in the last 24h (workspace activity)
  members?: DoriCtxMember[]; // only for workspace scope
  activeFocus?: { task_id: string; started_at: string } | null;
}

// Format an ISO timestamp as HH:mm in a specific timezone. Falls back to
// the host's local tz when no tz is passed — but edge runtimes default to
// UTC, so every caller that cares should pass one.
export function fmtTime(iso: string, tz?: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function fmtDate(iso: string, tz?: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
// YYYY-MM-DD string for the given instant in the target timezone.
export function ymdIn(iso: string | Date, tz?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // 'en-CA' yields ISO-shaped calendar dates.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
// Full local "now" for the AI prompt, e.g. "Saturday, 30 May 2026, 00:55".
// Edge runtimes default to UTC, so the AI must be told the user's local clock
// explicitly — otherwise "today" near midnight resolves to the wrong day.
export function fmtNowLocal(iso: string | Date, tz?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  // An invalid/unrecognised IANA tz makes toLocaleString throw a RangeError;
  // this runs during prompt construction, so fall back to UTC rather than
  // crashing the whole chat request.
  try {
    return d.toLocaleString("en-GB", { ...opts, timeZone: tz });
  } catch {
    return d.toLocaleString("en-GB", { ...opts, timeZone: "UTC" });
  }
}
// Current UTC offset for `tz` at instant `iso`, formatted like "+02:00".
// Empty/unknown tz → "+00:00".
export function tzOffset(iso: string | Date, tz?: string): string {
  if (!tz) return "+00:00";
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const name =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = name.match(/([+-])(\d{2}):?(\d{2})/);
    return m ? `${m[1]}${m[2]}:${m[3]}` : "+00:00";
  } catch {
    return "+00:00";
  }
}
// Whole-calendar-days between two YMDs. Positive if `later > earlier`.
export function daysBetweenYmd(earlier: string, later: string): number {
  const [y1, m1, d1] = earlier.split("-").map(Number);
  const [y2, m2, d2] = later.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Minimal Supabase client surface used by this module.
type DoriContextClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

export async function buildDoriContext(
  supabase: DoriContextClient,
  userId: string,
  workspaceId: string | null,
  opts?: { timezone?: string },
): Promise<DoriContext> {
  const tz = opts?.timezone;
  const now = new Date();
  // Anchor day boundaries to the USER's local calendar day, not the UTC edge
  // runtime — otherwise "today's events" is a day off near midnight. We build
  // local midnight from the user's YYYY-MM-DD + current UTC offset. (At the two
  // DST switchovers a year this can be ~1h off; acceptable for event bucketing.)
  // With no tz, ymdIn/tzOffset fall back to UTC, preserving prior behaviour.
  const offset = tzOffset(now, tz);
  const startOfToday = new Date(`${ymdIn(now, tz)}T00:00:00.000${offset}`);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const endOfToday = new Date(startOfTomorrow.getTime() - 1);
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000 - 1);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Build the scoped query base. Workspace mode pulls across all members;
  // personal pulls only the caller's own un-workspaced rows.
  const scope: "personal" | "workspace" = workspaceId ? "workspace" : "personal";
  type ScopedQuery = {
    eq(col: string, val: unknown): ScopedQuery;
    is(col: string, val: unknown): ScopedQuery;
  };
  const applyScope = <T extends ScopedQuery>(q: T): ScopedQuery =>
    workspaceId
      ? q.eq("workspace_id", workspaceId)
      : q.eq("user_id", userId).is("workspace_id", null);

  // All queries fire in parallel — the whole context snapshot arrives in one round-trip.
  const [tasksRes, eventsRes, weekEventsRes, completedRes, membersRes] = await Promise.all([
    applyScope(
      supabase
        .from("tasks")
        .select("id, title, priority, due_date, completed, assignee_id, workspace_id")
        .eq("completed", false)
        .eq("trashed", false),
    )
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),

    applyScope(
      supabase
        .from("events")
        .select("id, title, start_time, end_time, location, assignee_id, workspace_id")
        .gte("start_time", startOfToday.toISOString())
        .lte("start_time", endOfTomorrow.toISOString()),
    ).order("start_time"),

    applyScope(
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startOfToday.toISOString())
        .lt("start_time", endOfWeek.toISOString()),
    ),

    applyScope(
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("completed", true)
        .gte("updated_at", lastDay.toISOString()),
    ),

    workspaceId
      ? supabase
          .from("workspace_members")
          .select("user_id, display_name, role")
          .eq("workspace_id", workspaceId)
      : Promise.resolve({ data: null }),
  ]);

  const tasksRaw = (tasksRes.data || []) as DoriCtxTask[];
  // The DB already returned tasks ordered by due_date ASC with NULLS LAST,
  // so `tasksRaw` is already (overdue → today → future → undated). We only
  // need the overdue count + a top-N slice.
  const overdueCount = tasksRaw.reduce(
    (n, t) => (t.due_date && new Date(t.due_date) < startOfToday ? n + 1 : n),
    0,
  );
  const openTasks = tasksRaw.slice(0, 20);

  const eventsRaw = (eventsRes.data || []) as DoriCtxEvent[];
  const todayEvents = eventsRaw.filter((e) => {
    const t = new Date(e.start_time);
    return t >= startOfToday && t <= endOfToday;
  });
  const tomorrowEvents = eventsRaw.filter((e) => {
    const t = new Date(e.start_time);
    return t >= startOfTomorrow && t <= endOfTomorrow;
  });

  return {
    scope,
    workspaceId,
    now: now.toISOString(),
    timezone: tz,
    openTasks,
    overdueCount,
    todayEvents,
    tomorrowEvents,
    thisWeekEventCount: weekEventsRes.count || 0,
    recentCompletedCount: completedRes.count || 0,
    members: (membersRes.data as DoriCtxMember[]) || undefined,
    activeFocus: null, // hook up once a focus_sessions table exists
  };
}

// Human-readable context block (for use in an AI system prompt OR a plain
// digest message). Kept deliberately compact — ~30 lines max. All time
// strings respect `ctx.timezone` so the AI sees the user's local clock,
// not UTC (edge runtimes default to UTC and silently mislead the model).
export function formatContextForAI(ctx: DoriContext, callerName?: string): string {
  const name = callerName || "you";
  const tz = ctx.timezone;
  const parts: string[] = [];
  parts.push(`## LIVE CONTEXT (auto-refreshed every turn)`);
  parts.push(
    `Scope: ${ctx.scope === "workspace" ? `workspace (${ctx.workspaceId})` : "personal"}.`,
  );
  if (tz) {
    parts.push(
      `Now: ${fmtNowLocal(ctx.now, tz)} — user timezone ${tz} (UTC${tzOffset(ctx.now, tz)}). This is the user's LOCAL clock; resolve every relative date/time they mention ("today", "tonight", "tomorrow", "9:30") against it, and emit timestamps with this UTC offset.`,
    );
  } else {
    parts.push(`Now: ${ctx.now} (UTC — the user's timezone is unknown, so treat times as UTC).`);
  }

  if (ctx.overdueCount > 0) {
    parts.push(
      `⚠️ ${name} has ${ctx.overdueCount} overdue task${ctx.overdueCount === 1 ? "" : "s"}. Surface them early when relevant.`,
    );
  }

  if (ctx.openTasks.length > 0) {
    const lines = ctx.openTasks.slice(0, 10).map((t) => {
      const pr = t.priority === "high" ? "🔴" : t.priority === "low" ? "⚪️" : "🟡";
      const due = t.due_date ? ` (due ${ymdIn(t.due_date, tz)})` : "";
      return `  - [${t.id.slice(0, 8)}] ${pr} ${t.title}${due}`;
    });
    parts.push(`### Open tasks (top ${Math.min(10, ctx.openTasks.length)}):\n${lines.join("\n")}`);
  } else {
    parts.push(`### Open tasks: (none)`);
  }

  if (ctx.todayEvents.length > 0) {
    const lines = ctx.todayEvents.map((e) => {
      return `  - ${fmtTime(e.start_time, tz)} ${e.title}${e.location ? ` @ ${e.location}` : ""}`;
    });
    parts.push(`### Today's events:\n${lines.join("\n")}`);
  }

  if (ctx.tomorrowEvents.length > 0) {
    const lines = ctx.tomorrowEvents.slice(0, 5).map((e) => {
      return `  - ${fmtTime(e.start_time, tz)} ${e.title}`;
    });
    parts.push(`### Tomorrow: ${ctx.tomorrowEvents.length} events — ${lines.join(", ")}`);
  }

  if (ctx.scope === "workspace" && ctx.recentCompletedCount > 0) {
    parts.push(
      `${ctx.recentCompletedCount} task${ctx.recentCompletedCount === 1 ? "" : "s"} completed across the workspace in the last 24h.`,
    );
  }

  return parts.join("\n\n");
}
