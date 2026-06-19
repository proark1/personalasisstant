import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

export interface UserPattern {
  id: string;
  user_id: string;
  pattern_type: "correlation" | "trend" | "anomaly" | "prediction";
  category: "sleep" | "productivity" | "mood" | "health" | "exercise" | "general";
  title: string;
  description: string;
  confidence_score: number;
  correlation_strength?: number;
  variables: string[];
  data_points: unknown[];
  times_detected: number;
  first_detected_at: string;
  last_detected_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklySummary {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  tasks_completed: number;
  tasks_created: number;
  focus_minutes: number;
  habits_completed: number;
  habits_possible: number;
  avg_mood?: number;
  avg_energy?: number;
  avg_sleep_hours?: number;
  avg_sleep_quality?: number;
  avg_stress_level?: number;
  avg_focus_quality?: number;
  exercise_minutes: number;
  patterns_detected: unknown[];
  ai_summary?: string;
  created_at: string;
  updated_at: string;
}

export function useUserPatterns() {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<UserPattern[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchPatterns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("user_patterns")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("confidence_score", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPatterns((data || []) as UserPattern[]);
    } catch (error) {
      console.error("Error fetching patterns:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchWeeklySummaries = useCallback(
    async (limit = 8) => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("weekly_summaries")
          .select("*")
          .eq("user_id", user.id)
          .order("week_start", { ascending: false })
          .limit(limit);

        if (error) throw error;
        setWeeklySummaries((data || []) as WeeklySummary[]);
      } catch (error) {
        console.error("Error fetching weekly summaries:", error);
      }
    },
    [user],
  );

  const analyzePatterns = useCallback(async () => {
    if (!user) return;
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-patterns", {
        body: { userId: user.id },
      });

      if (error) throw error;

      if (data?.patterns?.length > 0) {
        toast.success(`Discovered ${data.patterns.length} new pattern(s)!`);
        await fetchPatterns();
      } else {
        toast.info("No new patterns found. Keep tracking for better insights!");
      }

      return data;
    } catch (error) {
      console.error("Error analyzing patterns:", error);
      toast.error(await describeEdgeError(error, "Failed to analyze patterns"));
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, fetchPatterns]);

  const dismissPattern = useCallback(
    async (patternId: string) => {
      if (!user) return;

      try {
        const { error } = await supabase
          .from("user_patterns")
          .update({ is_active: false })
          .eq("id", patternId)
          .eq("user_id", user.id);

        if (error) throw error;

        setPatterns((prev) => prev.filter((p) => p.id !== patternId));
        toast.success("Pattern dismissed");
      } catch (error) {
        console.error("Error dismissing pattern:", error);
        toast.error(await describeEdgeError(error, "Failed to dismiss pattern"));
      }
    },
    [user],
  );

  // Get patterns by category
  const getPatternsByCategory = useCallback(
    (category: UserPattern["category"]) => {
      return patterns.filter((p) => p.category === category);
    },
    [patterns],
  );

  // Get high confidence patterns
  const getHighConfidencePatterns = useCallback(
    (threshold = 0.7) => {
      return patterns.filter((p) => p.confidence_score >= threshold);
    },
    [patterns],
  );

  // Get latest weekly summary
  const getLatestSummary = useCallback(() => {
    return weeklySummaries[0] || null;
  }, [weeklySummaries]);

  useEffect(() => {
    if (user) {
      fetchPatterns();
      fetchWeeklySummaries();
    }
  }, [user, fetchPatterns, fetchWeeklySummaries]);

  return {
    patterns,
    weeklySummaries,
    isLoading,
    isAnalyzing,
    fetchPatterns,
    fetchWeeklySummaries,
    analyzePatterns,
    dismissPattern,
    getPatternsByCategory,
    getHighConfidencePatterns,
    getLatestSummary,
  };
}
