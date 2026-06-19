// Predictive slip-risk helper.
//
// Reads the dori_slip_risk view (which joins open tasks with the
// rolled-up dori_task_stats) and returns the at-risk subset, ranked
// by score. The proactive-assistant uses this to fire reminders
// BEFORE a task slips, so the user can catch it in time — not after
// the deadline has already passed.

export interface AtRiskTask {
  task_id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  category: string | null;
  priority: string | null;
  due_date: string | null;
  user_on_time_rate: number;
  expected_lead_hours: number;
  slip_risk: number;
}

export interface FetchOptions {
  userId: string;
  minRisk?: number; // default 0.55
  withinHours?: number; // only flag tasks due in next N hours; default 48
  limit?: number; // default 10
  workspaceId?: string | null;
  excludeOverdue?: boolean; // default true — we want predictive, not "already late"
}

// Minimal Supabase client surface needed by this module.
type SlipRiskClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

export async function fetchAtRiskTasks(
  supabase: SlipRiskClient,
  opts: FetchOptions,
): Promise<AtRiskTask[]> {
  const minRisk = opts.minRisk ?? 0.55;
  const withinHours = opts.withinHours ?? 48;
  const limit = opts.limit ?? 10;
  const excludeOverdue = opts.excludeOverdue ?? true;

  const horizon = new Date(Date.now() + withinHours * 3600_000).toISOString();
  const now = new Date().toISOString();

  let q = supabase
    .from("dori_slip_risk")
    .select("*")
    .eq("user_id", opts.userId)
    .gte("slip_risk", minRisk)
    .lte("due_date", horizon)
    .order("slip_risk", { ascending: false })
    .limit(limit);

  if (excludeOverdue) {
    q = q.gt("due_date", now);
  }
  if (opts.workspaceId !== undefined) {
    q = opts.workspaceId ? q.eq("workspace_id", opts.workspaceId) : q.is("workspace_id", null);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[fetchAtRiskTasks] failed", error.message);
    return [];
  }
  return (data ?? []) as AtRiskTask[];
}

// Render an at-risk task as a single-line nudge for an in-app
// notification or push. Keep it action-oriented — never just
// "this might slip" — and offer a one-tap reschedule.
export function nudgeMessage(t: AtRiskTask, tz?: string): string {
  const due = t.due_date ? new Date(t.due_date) : null;
  const dueLabel = due
    ? due.toLocaleString("en-GB", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "soon";
  const riskPct = Math.round(t.slip_risk * 100);
  return `📍 "${t.title}" is due ${dueLabel} — ${riskPct}% slip risk based on your history. Want to reschedule or break it down?`;
}
