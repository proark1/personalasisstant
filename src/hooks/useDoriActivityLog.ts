import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Read-only hook backing the user-facing "What Dori did" activity/audit log.
 *
 * It reads recent rows from `analytics_events` (RLS-scoped to the current user)
 * and surfaces only the categories meaningful as an assistant audit trail:
 * `proactive` (how the user responded to Dori's suggestions) and `ai` (actions
 * Dori took). Errors and raw navigation/search noise are intentionally excluded.
 *
 * This hook never writes — telemetry rows are produced by src/lib/telemetry.ts.
 */

/** Categories surfaced in the Dori activity log. */
export type DoriActivityKind = "proactive" | "ai";

export interface DoriActivityEntry {
  id: string;
  kind: DoriActivityKind;
  /** Raw event_type, e.g. `proactive_action_accepted`. */
  type: string;
  /** The proactive surface this relates to, if recorded in event_data. */
  surface?: string;
  /** Human-readable, user-facing description of what happened. */
  summary: string;
  createdAt: string;
}

interface AnalyticsRow {
  id: string;
  event_type: string;
  event_category: string;
  event_data: unknown;
  created_at: string;
}

const ACTIVITY_CATEGORIES: DoriActivityKind[] = ["proactive", "ai"];

// A list of recent rows is plenty for an audit surface; cap it.
const ROW_LIMIT = 100;

/** Turn a snake/camel surface key into a readable phrase, e.g. `agent_action_inbox` → "agent action inbox". */
function humanizeSurface(surface: string): string {
  return surface
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
}

/** Turn an event_type into a readable label as a fallback, e.g. `email_drafted` → "Email drafted". */
function humanizeType(type: string): string {
  const words = type.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Pure mapping from an analytics_events row to a typed, user-facing entry.
 * Exported for testability; kept free of React/Supabase concerns.
 */
export function mapRowToEntry(row: AnalyticsRow): DoriActivityEntry {
  const kind: DoriActivityKind = row.event_category === "proactive" ? "proactive" : "ai";
  const data = asRecord(row.event_data);
  const surface = typeof data.surface === "string" ? data.surface : undefined;

  return {
    id: row.id,
    kind,
    type: row.event_type,
    surface,
    summary: summarize(kind, row.event_type, surface, data),
    createdAt: row.created_at,
  };
}

/** Derive a friendly, second-person summary from the event details. */
function summarize(
  kind: DoriActivityKind,
  type: string,
  surface: string | undefined,
  data: Record<string, unknown>,
): string {
  const from = surface ? ` from Dori (${humanizeSurface(surface)})` : " from Dori";

  if (kind === "proactive") {
    switch (type) {
      case "proactive_action_accepted":
        return `You accepted a suggestion${from}`;
      case "proactive_action_dismissed":
        return `You dismissed a suggestion${from}`;
      case "proactive_action_muted":
        return `You muted suggestions${surface ? ` from ${humanizeSurface(surface)}` : ""}`;
      case "proactive_action_shown":
        return surface
          ? `Dori suggested something (${humanizeSurface(surface)})`
          : "Dori suggested something";
      default:
        return `Dori suggestion: ${humanizeType(type)}`;
    }
  }

  // kind === 'ai': prefer an explicit label/summary recorded in event_data.
  const label =
    (typeof data.summary === "string" && data.summary) ||
    (typeof data.label === "string" && data.label) ||
    (typeof data.action === "string" && humanizeType(data.action)) ||
    (typeof data.description === "string" && data.description);

  if (label) return `Dori ${String(label).charAt(0).toLowerCase()}${String(label).slice(1)}`;

  return `Dori performed an action: ${humanizeType(type)}`;
}

export function useDoriActivityLog() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["dori-activity-log", userId],
    enabled: !!userId,
    // Audit data changes slowly relative to a panel open; avoid refetch churn.
    staleTime: 60_000,
    queryFn: async (): Promise<DoriActivityEntry[]> => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("id, event_type, event_category, event_data, created_at")
        .eq("user_id", userId!)
        .in("event_category", ACTIVITY_CATEGORIES)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);

      if (error) throw error;
      return (data ?? []).map((row) => mapRowToEntry(row as AnalyticsRow));
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
