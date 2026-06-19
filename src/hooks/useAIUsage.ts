import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AIUsageSummary {
  spent_cents: number;
  cap_cents: number;
  headroom_cents: number;
  used_pct: number;
  over_cap: boolean;
  calls: number;
  tokens: number;
}

export interface AIUsageMonth {
  month: string;
  calls: number;
  total_tokens: number;
  cost_cents: number;
}

// Reads ai_usage_summary (current month rollup with cap headroom) +
// ai_usage_monthly (12-month series). Used by the Memory dashboard's
// "AI usage" subsection to surface cost transparency to the user.
export function useAIUsage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AIUsageSummary | null>(null);
  const [monthly, setMonthly] = useState<AIUsageMonth[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const [sRes, mRes] = await Promise.all([
        db.from("ai_usage_summary").select("*").eq("user_id", user.id).maybeSingle(),
        db
          .from("ai_usage_monthly")
          .select("*")
          .eq("user_id", user.id)
          .order("month", { ascending: false })
          .limit(12),
      ]);
      if (sRes.data) {
        setSummary({
          spent_cents: Number(sRes.data.spent_cents ?? 0),
          cap_cents: Number(sRes.data.cap_cents ?? 500),
          headroom_cents: Number(sRes.data.headroom_cents ?? 0),
          used_pct: Number(sRes.data.used_pct ?? 0),
          over_cap: !!sRes.data.over_cap,
          calls: Number(sRes.data.calls ?? 0),
          tokens: Number(sRes.data.tokens ?? 0),
        });
      } else {
        // No row yet — user has made zero AI calls. Render the empty state.
        setSummary({
          spent_cents: 0,
          cap_cents: 500,
          headroom_cents: 500,
          used_pct: 0,
          over_cap: false,
          calls: 0,
          tokens: 0,
        });
      }
      setMonthly(
        (mRes.data ?? []).map((r: Record<string, unknown>) => ({
          month: r.month,
          calls: Number(r.calls ?? 0),
          total_tokens: Number(r.total_tokens ?? 0),
          cost_cents: Number(r.cost_cents ?? 0),
        })),
      );
    } catch (e) {
      console.warn("[useAIUsage] refresh failed", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, monthly, loading, refresh };
}
