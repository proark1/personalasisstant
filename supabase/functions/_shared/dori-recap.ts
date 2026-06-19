// Workspace weekly recap generator.
//
// Mechanical digest of what shipped this week, what's in flight, who's
// doing what, and what's upcoming. Designed for Friday-evening posts to
// the linked Telegram group (and in-app notifications), but also callable
// on demand via /recap.

import { daysBetweenYmd, ymdIn, fmtDate } from "./dori-context.ts";

export interface WorkspaceRecap {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  shipped: { title: string; assignee: string | null }[];
  inProgress: { title: string; assignee: string | null; due_date: string | null }[];
  blockers: { title: string; assignee: string | null; days_overdue: number }[];
  upcoming: { title: string; start_time: string }[];
  perMember: { display_name: string; user_id: string; shipped: number; open: number }[];
}

// Minimal Supabase client surface needed by this module.
type RecapClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

interface RecapMember {
  user_id: string;
  display_name: string | null;
}
interface RecapTask {
  title: string;
  assignee_id?: string | null;
  user_id: string;
  due_date?: string | null;
}
interface RecapEvent {
  title: string;
  start_time: string;
}

export async function buildWorkspaceWeeklyRecap(
  supabase: RecapClient,
  workspaceId: string,
  opts?: { days?: number; timezone?: string },
): Promise<WorkspaceRecap> {
  const days = opts?.days ?? 7;
  const tz = opts?.timezone;
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const periodEnd = now;

  const [{ data: members }, { data: shippedRows }, { data: openRows }, { data: upcomingRows }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("user_id, display_name")
        .eq("workspace_id", workspaceId),
      supabase
        .from("tasks")
        .select("title, assignee_id, user_id")
        .eq("workspace_id", workspaceId)
        .eq("completed", true)
        .gte("updated_at", periodStart.toISOString()),
      supabase
        .from("tasks")
        .select("title, assignee_id, user_id, due_date")
        .eq("workspace_id", workspaceId)
        .eq("completed", false)
        .eq("trashed", false)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("events")
        .select("title, start_time")
        .eq("workspace_id", workspaceId)
        .gte("start_time", now.toISOString())
        .lt("start_time", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("start_time")
        .limit(10),
    ]);

  const nameFor = (uid: string | null | undefined) => {
    if (!uid) return null;
    return ((members as RecapMember[]) || []).find((m) => m.user_id === uid)?.display_name || null;
  };

  const shipped = ((shippedRows as RecapTask[]) || []).map((t) => ({
    title: t.title,
    assignee: nameFor(t.assignee_id || t.user_id),
  }));

  const inProgress = ((openRows as RecapTask[]) || []).slice(0, 15).map((t) => ({
    title: t.title,
    assignee: nameFor(t.assignee_id || t.user_id),
    due_date: t.due_date,
  }));

  // Use calendar-day math in the target timezone so "due late yesterday /
  // now early today" reports 1 day overdue (not 0 via millisecond division).
  const todayYmd = ymdIn(now, tz);
  const blockers = ((openRows as RecapTask[]) || [])
    .filter((t) => t.due_date && new Date(t.due_date) < now)
    .map((t) => ({
      title: t.title,
      assignee: nameFor(t.assignee_id || t.user_id),
      days_overdue: Math.max(1, daysBetweenYmd(ymdIn(t.due_date!, tz), todayYmd)),
    }))
    .slice(0, 5);

  const upcoming = ((upcomingRows as RecapEvent[]) || []).map((e) => ({
    title: e.title,
    start_time: e.start_time,
  }));

  const perMember = ((members as RecapMember[]) || []).map((m) => {
    const shippedCount = ((shippedRows as RecapTask[]) || []).filter(
      (t) => (t.assignee_id || t.user_id) === m.user_id,
    ).length;
    const openCount = ((openRows as RecapTask[]) || []).filter(
      (t) => (t.assignee_id || t.user_id) === m.user_id,
    ).length;
    return {
      display_name: m.display_name || m.user_id.slice(0, 8),
      user_id: m.user_id,
      shipped: shippedCount,
      open: openCount,
    };
  });

  return {
    workspaceId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    shipped,
    inProgress,
    blockers,
    upcoming,
    perMember,
  };
}

export function formatRecapForTelegram(
  recap: WorkspaceRecap,
  workspaceName?: string,
  tz?: string,
): string {
  const lines: string[] = [];
  const label = workspaceName ? `for <b>${workspaceName}</b>` : "";
  lines.push(`<b>📦 Weekly recap</b> ${label}`.trim());
  const dfmt = { timeZone: tz, day: "2-digit", month: "short" } as const;
  lines.push(
    `<i>${new Date(recap.periodStart).toLocaleDateString("en-GB", dfmt)} → ${new Date(recap.periodEnd).toLocaleDateString("en-GB", dfmt)}</i>`,
  );

  if (recap.shipped.length) {
    lines.push(`\n<b>✅ Shipped (${recap.shipped.length})</b>`);
    recap.shipped
      .slice(0, 10)
      .forEach((s) => lines.push(`• ${s.title}${s.assignee ? ` <i>— ${s.assignee}</i>` : ""}`));
    if (recap.shipped.length > 10) lines.push(`<i>…and ${recap.shipped.length - 10} more.</i>`);
  } else {
    lines.push(`\n<b>✅ Shipped:</b> nothing closed this week.`);
  }

  if (recap.blockers.length) {
    lines.push(`\n<b>⚠️ Blockers</b>`);
    recap.blockers.forEach((b) =>
      lines.push(
        `• ${b.title}${b.assignee ? ` <i>— ${b.assignee}</i>` : ""} (${b.days_overdue}d overdue)`,
      ),
    );
  }

  if (recap.inProgress.length) {
    lines.push(`\n<b>🚧 In flight</b>`);
    recap.inProgress
      .slice(0, 8)
      .forEach((t) =>
        lines.push(
          `• ${t.title}${t.assignee ? ` <i>— ${t.assignee}</i>` : ""}${t.due_date ? ` <i>(due ${fmtDate(t.due_date, tz)})</i>` : ""}`,
        ),
      );
  }

  if (recap.upcoming.length) {
    lines.push(`\n<b>📅 Next 7 days</b>`);
    recap.upcoming.slice(0, 5).forEach((e) => {
      lines.push(`• ${fmtDate(e.start_time, tz)} — ${e.title}`);
    });
  }

  lines.push(`\n<b>👥 Activity</b>`);
  const sorted = [...recap.perMember].sort((a, b) => b.shipped - a.shipped);
  sorted.forEach((m) => lines.push(`• ${m.display_name}: ${m.shipped} shipped, ${m.open} open`));

  return lines.join("\n");
}
