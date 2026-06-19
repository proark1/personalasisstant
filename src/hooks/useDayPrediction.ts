import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DayPrediction {
  score: number; // 1-10
  label: "challenging" | "moderate" | "good" | "excellent";
  factors: {
    positive: string[];
    negative: string[];
  };
  suggestions: string[];
  insight: string;
}

export function useDayPrediction() {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<DayPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  const predictDay = useCallback(async () => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      // Fetch recent check-ins for patterns
      const { data: recentCheckins } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", user.id)
        .order("checkin_date", { ascending: false })
        .limit(7);

      // Fetch today's events
      const today = new Date().toISOString().split("T")[0];
      const { data: todayEvents } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", `${today}T00:00:00`)
        .lte("start_time", `${today}T23:59:59`);

      // Fetch pending tasks
      const { data: pendingTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .eq("trashed", false);

      // Calculate prediction based on data
      const factors: DayPrediction["factors"] = { positive: [], negative: [] };
      let score = 5; // Base score

      // Analyze sleep from recent check-in
      const lastCheckin = recentCheckins?.[0];
      if (lastCheckin?.sleep_hours) {
        if (lastCheckin.sleep_hours >= 7) {
          score += 1;
          factors.positive.push("Good sleep last night");
        } else if (lastCheckin.sleep_hours < 6) {
          score -= 1;
          factors.negative.push("Low sleep - might feel tired");
        }
      }

      // Analyze calendar load
      const eventCount = todayEvents?.length || 0;
      if (eventCount === 0) {
        score += 0.5;
        factors.positive.push("Clear calendar for deep work");
      } else if (eventCount <= 3) {
        factors.positive.push(`${eventCount} manageable events`);
      } else if (eventCount > 5) {
        score -= 1;
        factors.negative.push(`Busy day: ${eventCount} events`);
      }

      // Analyze task load
      const highPriorityTasks = pendingTasks?.filter((t) => t.priority === "high") || [];
      const overdueTasks =
        pendingTasks?.filter((t) => t.due_date && new Date(t.due_date) < new Date()) || [];

      if (highPriorityTasks.length > 3) {
        score -= 0.5;
        factors.negative.push(`${highPriorityTasks.length} high-priority tasks`);
      }
      if (overdueTasks.length > 0) {
        score -= 0.5;
        factors.negative.push(`${overdueTasks.length} overdue tasks`);
      }
      if (highPriorityTasks.length <= 2 && overdueTasks.length === 0) {
        score += 0.5;
        factors.positive.push("Task load is manageable");
      }

      // Analyze mood trend
      if (recentCheckins && recentCheckins.length >= 3) {
        const moodValues = recentCheckins
          .filter((c) => c.mood)
          .slice(0, 3)
          .map((c) => getMoodValue(c.mood));

        if (moodValues.length >= 2) {
          const avgMood = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;
          if (avgMood >= 4) {
            score += 0.5;
            factors.positive.push("Positive mood trend");
          } else if (avgMood <= 2) {
            score -= 0.5;
            factors.negative.push("Recent mood has been low");
          }
        }
      }

      // Clamp score
      score = Math.max(1, Math.min(10, Math.round(score)));

      // Determine label
      let label: DayPrediction["label"];
      if (score <= 3) label = "challenging";
      else if (score <= 5) label = "moderate";
      else if (score <= 7) label = "good";
      else label = "excellent";

      // Generate suggestions
      const suggestions: string[] = [];
      if (factors.negative.includes("Low sleep - might feel tired")) {
        suggestions.push("Take short breaks and avoid complex decisions in the afternoon");
      }
      if (eventCount > 5) {
        suggestions.push("Block 30 minutes for yourself between meetings");
      }
      if (highPriorityTasks.length > 3) {
        suggestions.push("Focus on just the top 2 tasks to avoid overwhelm");
      }
      if (factors.positive.includes("Clear calendar for deep work")) {
        suggestions.push("Great day for tackling that big project you've been postponing");
      }

      // Generate insight
      const insight = generateInsight(label, factors, eventCount, highPriorityTasks.length);

      const result: DayPrediction = {
        score,
        label,
        factors,
        suggestions,
        insight,
      };

      setPrediction(result);
      return result;
    } catch (err) {
      console.error("Error predicting day:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-predict on mount
  useEffect(() => {
    predictDay();
  }, [predictDay]);

  return {
    prediction,
    loading,
    predictDay,
  };
}

function getMoodValue(mood: string): number {
  const moodMap: Record<string, number> = {
    "😊": 5,
    "🙂": 4,
    "😐": 3,
    "😔": 2,
    "😤": 2,
    "😰": 1,
  };
  return moodMap[mood] || 3;
}

function generateInsight(
  label: DayPrediction["label"],
  factors: DayPrediction["factors"],
  eventCount: number,
  _highPriorityCount: number,
): string {
  if (label === "excellent") {
    return "Today looks great! You're well-rested with a manageable schedule - perfect for making real progress.";
  }
  if (label === "good") {
    return "Solid day ahead. Stay focused and you'll accomplish a lot.";
  }
  if (label === "moderate") {
    if (eventCount > 5) {
      return "Busy day with lots of context-switching. Prioritize ruthlessly and protect small pockets of focus time.";
    }
    return "Average day expected. Be intentional about your energy and tackle important work early.";
  }
  // challenging
  if (factors.negative.includes("Low sleep - might feel tired")) {
    return "You might feel tired today. Be kind to yourself - focus on just the essentials.";
  }
  return "Tough day ahead. Consider what you can postpone or delegate. One step at a time.";
}
