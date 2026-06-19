export interface QuickTask {
  title: string;
}

export interface QuickEvent {
  title: string;
  start_time: string;
}

export interface MemorySnapshotRow {
  memory_type?: string | null;
  category?: string | null;
  key?: string | null;
  value?: string | null;
}

export interface PreferenceSnapshotRow {
  key?: string | null;
  value?: string | null;
  confidence?: number | null;
  times_seen?: number | null;
}

export function truncateTelegramText(s: unknown, maxChars: number): string {
  const text = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  if (maxChars === 1) return "…";
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

export function escapeTelegramHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatTelegramDate(iso?: string | null, tz?: string): string {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  try {
    return d.toLocaleString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

export function userDayYmd(date: Date, tz?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-CA", opts).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: "UTC" }).format(date);
  }
}

export function buildBestNextActionMessage(args: {
  pendingCount: number;
  workspaceId: string | null;
  nextEvent?: QuickEvent | null;
  overdue?: QuickTask | null;
  dueToday?: QuickTask | null;
  now: Date;
  timezone?: string;
}): string {
  const { pendingCount, workspaceId, nextEvent, overdue, dueToday, now, timezone } = args;
  const msUntilNextEvent = nextEvent
    ? new Date(nextEvent.start_time).getTime() - now.getTime()
    : null;
  const nextEventIsSoon =
    msUntilNextEvent !== null && msUntilNextEvent >= 0 && msUntilNextEvent <= 45 * 60 * 1000;
  const parts: string[] = [
    workspaceId ? "<b>🎯 Best next move — workspace</b>" : "<b>🎯 Best next move</b>",
  ];
  if (pendingCount > 0) {
    parts.push(
      `You have <b>${pendingCount}</b> pending approval${pendingCount === 1 ? "" : "s"}. Clear those first so Dori can finish queued work.`,
    );
    parts.push("Send <code>/approvals</code> to approve or cancel them.");
  } else if (nextEvent && nextEventIsSoon) {
    parts.push(
      `Prep for <b>${escapeTelegramHtml(truncateTelegramText(nextEvent.title, 120))}</b> at ${escapeTelegramHtml(formatTelegramDate(nextEvent.start_time, timezone))}.`,
    );
    parts.push("Ask me: <code>prep me for this meeting</code>.");
  } else if (overdue) {
    parts.push(
      `Tackle overdue task: <b>${escapeTelegramHtml(truncateTelegramText(overdue.title, 120))}</b>.`,
    );
    parts.push(
      "If it no longer matters, reply: <code>delete that task</code>. If it should move, reply: <code>move it to tomorrow</code>.",
    );
  } else if (dueToday) {
    parts.push(
      `Do today’s task: <b>${escapeTelegramHtml(truncateTelegramText(dueToday.title, 120))}</b>.`,
    );
    parts.push("When done, reply: <code>done</code> or <code>mark that complete</code>.");
  } else if (nextEvent) {
    parts.push(
      `Your next event is <b>${escapeTelegramHtml(truncateTelegramText(nextEvent.title, 120))}</b> at ${escapeTelegramHtml(formatTelegramDate(nextEvent.start_time, timezone))}.`,
    );
    parts.push("Use the open block before then for your highest-energy work.");
  } else {
    parts.push(
      "Nothing urgent is visible. Use this as a planning block: send <code>plan my day</code> or capture anything on your mind by voice note.",
    );
  }

  return parts.join("\n\n");
}

export function buildMemorySnapshotMessage(args: {
  workspaceId: string | null;
  memoryRows: MemorySnapshotRow[];
  prefRows: PreferenceSnapshotRow[];
}): string {
  const { workspaceId, memoryRows, prefRows } = args;
  const parts: string[] = ["<b>🧠 What I remember</b>"];
  if (workspaceId) {
    parts.push("Scope: active workspace facts. Learned preferences below are global.");
  }
  if (memoryRows.length === 0 && prefRows.length === 0) {
    parts.push(
      "I do not have saved facts or learned preferences yet. Tell me “remember that …” and I’ll store useful context.",
    );
  }
  if (memoryRows.length > 0) {
    parts.push("\n<b>Saved facts</b>");
    memoryRows.forEach((m) => {
      const label = truncateTelegramText(m.key || m.memory_type || "memory", 80);
      const category = m.category ? ` · ${truncateTelegramText(m.category, 40)}` : "";
      const value = truncateTelegramText(m.value || "", 220);
      parts.push(
        `• <b>${escapeTelegramHtml(label)}</b>${escapeTelegramHtml(category)}: ${escapeTelegramHtml(value)}`,
      );
    });
  }
  if (prefRows.length > 0) {
    parts.push("\n<b>Learned preferences</b>");
    prefRows.forEach((pref) => {
      const confidence =
        typeof pref.confidence === "number" ? ` (${Math.round(pref.confidence * 100)}%)` : "";
      const seen = pref.times_seen ? ` · seen ${pref.times_seen}×` : "";
      const key = truncateTelegramText(pref.key || "preference", 80);
      const value = truncateTelegramText(pref.value || "", 180);
      parts.push(
        `• <b>${escapeTelegramHtml(key)}</b>: ${escapeTelegramHtml(value)}${confidence}${seen}`,
      );
    });
  }
  parts.push(
    "\nTo remove something, say <code>forget ...</code>. To add context, say <code>remember that ...</code>.",
  );
  return parts.join("\n");
}
