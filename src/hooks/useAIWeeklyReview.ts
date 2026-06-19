import { useState, useCallback } from "react";
import { Task } from "@/types/flux";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { startOfWeek, endOfWeek, format, subWeeks } from "date-fns";

export interface WeeklyReviewSummary {
  overview: {
    tasksCompleted: number;
    tasksCreated: number;
    completionRate: number;
    focusMinutes: number;
    topCategory: string;
  };
  achievements: string[];
  patterns: string[];
  areasForImprovement: string[];
  weeklyScore: number;
  personalizedTip: string;
  nextWeekSuggestions: string[];
}

export function useAIWeeklyReview() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklyReviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReview = useCallback(
    async (tasks: Task[]) => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

        // Get tasks from this week
        const thisWeekTasks = tasks.filter((t) => {
          const created = new Date(t.createdAt);
          return created >= weekStart;
        });

        // Get focus sessions from last week
        const { data: focusSessions } = await supabase
          .from("focus_sessions")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .eq("is_completed", true)
          .gte("started_at", lastWeekStart.toISOString())
          .lte("started_at", lastWeekEnd.toISOString());

        const totalFocusMinutes =
          focusSessions?.reduce((sum, s) => sum + s.duration_minutes, 0) || 0;

        // Get check-ins from last week
        const { data: checkins } = await supabase
          .from("daily_checkins")
          .select("mood, energy_level, sleep_hours, day_rating")
          .eq("user_id", user.id)
          .gte("checkin_date", format(lastWeekStart, "yyyy-MM-dd"))
          .lte("checkin_date", format(lastWeekEnd, "yyyy-MM-dd"));

        const completedTasks = thisWeekTasks.filter((t) => t.completed);
        const completionRate =
          thisWeekTasks.length > 0
            ? Math.round((completedTasks.length / thisWeekTasks.length) * 100)
            : 0;

        // Calculate top category
        const categoryCount = completedTasks.reduce(
          (acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        const topCategory =
          Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0]?.[0] || "personal";

        // Call AI for insights
        const response = await supabase.functions.invoke("weekly-review", {
          body: {
            tasks: thisWeekTasks.slice(0, 50).map((t) => ({
              title: t.title,
              category: t.category,
              priority: t.priority,
              completed: t.completed,
              dueDate: t.dueDate,
            })),
            focusMinutes: totalFocusMinutes,
            completionRate,
            checkins: checkins || [],
            weekStartDate: format(lastWeekStart, "yyyy-MM-dd"),
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const data = response.data;

        setSummary({
          overview: {
            tasksCompleted: completedTasks.length,
            tasksCreated: thisWeekTasks.length,
            completionRate,
            focusMinutes: totalFocusMinutes,
            topCategory,
          },
          achievements: data.achievements || [],
          patterns: data.patterns || [],
          areasForImprovement: data.areasForImprovement || [],
          weeklyScore:
            data.weeklyScore || Math.min(100, completionRate + Math.floor(totalFocusMinutes / 10)),
          personalizedTip: data.personalizedTip || "Keep up the great work!",
          nextWeekSuggestions: data.nextWeekSuggestions || [],
        });
      } catch (err) {
        console.error("Failed to generate weekly review:", err);
        setError(await describeEdgeError(err, "Failed to generate review"));
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const clearReview = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  return {
    summary,
    loading,
    error,
    generateReview,
    clearReview,
  };
}
