import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { useAuth } from "./useAuth";

interface BriefingHighlight {
  type: "task" | "calendar" | "email" | "contract" | "contact" | "habit";
  label: string;
}

interface DailyBriefing {
  briefingText: string;
  highlights: BriefingHighlight[];
  generatedAt: string;
}

const CACHE_KEY = "darai_daily_briefing";

function getCachedBriefing(): DailyBriefing | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached) as DailyBriefing;
    const today = new Date().toISOString().split("T")[0];
    if (data.generatedAt?.startsWith(today)) return data;
    return null;
  } catch {
    return null;
  }
}

export function useDailyBriefing() {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(getCachedBriefing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(
    async (force = false) => {
      if (!user) return;
      if (!force && briefing) return;

      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "daily-voice-briefing",
          {},
        );
        if (fnError) throw fnError;

        const result: DailyBriefing = {
          briefingText: data.briefingText,
          highlights: data.highlights || [],
          generatedAt: new Date().toISOString(),
        };
        setBriefing(result);
        localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch (e) {
        console.error("Daily briefing error:", e);
        setError(await describeEdgeError(e, "Failed to generate briefing"));
      } finally {
        setLoading(false);
      }
    },
    [user, briefing],
  );

  useEffect(() => {
    if (user && !briefing) {
      fetchBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // intentionally omits briefing/fetchBriefing — runs once when user becomes available

  return { briefing, loading, error, refresh: () => fetchBriefing(true) };
}
