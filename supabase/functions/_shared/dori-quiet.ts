// Unified "should I nudge this user right now?" check.
//
// Every proactive send point (dori-proactive, push-delivery, meeting-*,
// recap cron…) routes through this helper so Dori doesn't turn into a
// spam cannon during meetings, at 3am, or while the user is trying to
// focus for two hours.

export interface QuietCheckOpts {
  // If false the caller opts out of event-based suppression (e.g. the
  // actual meeting-preflight nudge must fire DURING the window up to the
  // event start). Default true.
  respectEvents?: boolean;
  // If false, focus-mode is ignored (very-high-priority alerts only).
  respectFocus?: boolean;
  // Batch callers (like dori-proactive's user loop) already have the
  // timezone and settings row in memory — passing them in here avoids
  // two redundant round-trips per user. The helper still fetches any
  // field that wasn't prefetched.
  prefetched?: {
    timezone?: string | null;
    settings?: QuietSettings | null;
  };
}

export interface QuietState {
  quiet: boolean;
  reason?: "focus" | "quiet_hours" | "in_event" | "disabled";
  resumeAt?: string; // ISO — when quiet will end (if bounded)
}

interface QuietSettings {
  enabled?: boolean | null;
  quiet_hours_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  focus_mode_until?: string | null;
  suppress_during_events?: boolean | null;
}

// Hour-of-day (0-23) for `now` as observed in `tz`. Falls back to the
// edge runtime's (UTC) clock when no tz is known.
function hourInTz(now: Date, tz?: string): number {
  if (!tz) return now.getHours();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value;
  return h ? Number(h) % 24 : 0;
}

function minuteInTz(now: Date, tz?: string): number {
  if (!tz) return now.getMinutes();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    minute: "2-digit",
  }).formatToParts(now);
  const m = parts.find((p) => p.type === "minute")?.value;
  return m ? Number(m) : 0;
}

// HH:mm in the user's tz, as minutes since midnight.
function minutesSinceMidnight(now: Date, tz?: string): number {
  return hourInTz(now, tz) * 60 + minuteInTz(now, tz);
}

// Parse "HH:mm" or "HH:mm:ss" → minutes since midnight; null if bad shape.
function parseHHMM(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return (Number(m[1]) % 24) * 60 + (Number(m[2]) % 60);
}

// Minimal Supabase client surface needed by this module.
interface QueryResult {
  data: Record<string, unknown> | null;
}

interface QueryFilter {
  eq(column: string, value: unknown): QueryFilter;
  lte(column: string, value: unknown): QueryFilter;
  gte(column: string, value: unknown): QueryFilter;
  limit(count: number): QueryFilter;
  maybeSingle(): PromiseLike<QueryResult>;
}

interface QueryTable {
  select(columns: string): QueryFilter;
}

type QuietClient = { from(table: string): unknown };

function table(supabase: QuietClient, name: string): QueryTable {
  return supabase.from(name) as QueryTable;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function settingsValue(value: Record<string, unknown> | null): QuietSettings | null {
  return value as QuietSettings | null;
}

export async function isUserQuietNow(
  supabase: QuietClient,
  userId: string,
  opts: QuietCheckOpts = {},
): Promise<QuietState> {
  if (!userId) return { quiet: false };
  const { respectEvents = true, respectFocus = true, prefetched } = opts;

  // Use prefetched data where available, otherwise hit the DB. Batch
  // callers pass in both and skip all the profile/settings lookups.
  let settings = prefetched?.settings ?? null;
  let tz = prefetched?.timezone ?? undefined;
  const needSettings = !settings;
  const needTz = tz === undefined;
  if (needSettings || needTz) {
    const lookups: Promise<{ data: Record<string, unknown> | null }>[] = [];
    if (needTz) {
      lookups.push(
        Promise.resolve(
          table(supabase, "profiles").select("timezone").eq("user_id", userId).maybeSingle(),
        ),
      );
    }
    if (needSettings) {
      lookups.push(
        Promise.resolve(
          table(supabase, "proactive_settings")
            .select(
              "enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, focus_mode_until, suppress_during_events",
            )
            .eq("user_id", userId)
            .maybeSingle(),
        ),
      );
    }
    const results = await Promise.all(lookups);
    let idx = 0;
    if (needTz) {
      tz = stringValue(results[idx++]?.data?.timezone);
    }
    if (needSettings) {
      settings = settingsValue(results[idx++]?.data || null);
    }
  }
  if (!settings) return { quiet: false };
  if (settings.enabled === false) return { quiet: true, reason: "disabled" };

  const now = new Date();

  // 1. Focus mode wins over everything short of disabled.
  if (respectFocus && settings.focus_mode_until) {
    const until = new Date(settings.focus_mode_until);
    if (until.getTime() > now.getTime()) {
      return { quiet: true, reason: "focus", resumeAt: until.toISOString() };
    }
  }

  // 2. Quiet hours (tz-aware). Handles windows that cross midnight (22:00-07:00).
  if (settings.quiet_hours_enabled) {
    const start = parseHHMM(settings.quiet_hours_start);
    const end = parseHHMM(settings.quiet_hours_end);
    if (start !== null && end !== null) {
      const nowMin = minutesSinceMidnight(now, tz);
      const crossesMidnight = start >= end;
      const inside = crossesMidnight
        ? nowMin >= start || nowMin < end
        : nowMin >= start && nowMin < end;
      if (inside) return { quiet: true, reason: "quiet_hours" };
    }
  }

  // 3. Don't nudge while a calendar event is in progress, if enabled.
  if (respectEvents && settings.suppress_during_events !== false) {
    const nowIso = now.toISOString();
    const { data: live } = await table(supabase, "events")
      .select("end_time")
      .eq("user_id", userId)
      .lte("start_time", nowIso)
      .gte("end_time", nowIso)
      .limit(1)
      .maybeSingle();
    if (live) {
      return { quiet: true, reason: "in_event", resumeAt: stringValue(live.end_time) };
    }
  }

  return { quiet: false };
}
