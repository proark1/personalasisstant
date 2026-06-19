import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface WeeklyCoachReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  tasksCompleted: number;
  tasksCreated: number;
  focusMinutes: number;
  habitsCompleted: number;
  habitsMissed: number;
  averageMood: number | null;
  averageEnergy: number | null;
  averageSleep: number | null;
  summaryText: string | null;
  wins: string[];
  improvements: string[];
  recommendations: string[];
  correlationsFound: { type: string; insight: string }[];
  goalProgress: Record<string, number>;
  productivityScore: number | null;
  wellbeingScore: number | null;
  balanceScore: number | null;
  isRead: boolean;
  createdAt: string;
}

export function useWeeklyCoach() {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyCoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchLatestReport = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weekly_coach_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setReport({
          id: data.id,
          weekStart: data.week_start,
          weekEnd: data.week_end,
          tasksCompleted: data.tasks_completed || 0,
          tasksCreated: data.tasks_created || 0,
          focusMinutes: data.focus_minutes || 0,
          habitsCompleted: data.habits_completed || 0,
          habitsMissed: data.habits_missed || 0,
          averageMood: data.average_mood,
          averageEnergy: data.average_energy,
          averageSleep: data.average_sleep,
          summaryText: data.summary_text,
          wins: (data.wins as string[]) || [],
          improvements: (data.improvements as string[]) || [],
          recommendations: (data.recommendations as string[]) || [],
          correlationsFound: (data.correlations_found as { type: string; insight: string }[]) || [],
          goalProgress: (data.goal_progress as Record<string, number>) || {},
          productivityScore: data.productivity_score,
          wellbeingScore: data.wellbeing_score,
          balanceScore: data.balance_score,
          isRead: data.is_read,
          createdAt: data.created_at,
        });
      }
    } catch (err) {
      console.error("Error fetching weekly report:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const generateReport = useCallback(async () => {
    if (!user?.id) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-coach", {
        body: { userId: user.id },
      });

      if (error) throw error;

      await fetchLatestReport();
      return data;
    } catch (err) {
      console.error("Error generating report:", err);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [user?.id, fetchLatestReport]);

  const markAsRead = useCallback(async () => {
    if (!user?.id || !report?.id) return;

    try {
      const { error } = await supabase
        .from("weekly_coach_reports")
        .update({ is_read: true })
        .eq("id", report.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setReport((prev) => (prev ? { ...prev, isRead: true } : null));
    } catch (err) {
      console.error("Error marking report as read:", err);
    }
  }, [user?.id, report?.id]);

  useEffect(() => {
    fetchLatestReport();
  }, [fetchLatestReport]);

  return {
    report,
    loading,
    generating,
    fetchLatestReport,
    generateReport,
    markAsRead,
  };
}
