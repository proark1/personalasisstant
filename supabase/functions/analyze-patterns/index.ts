import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate the user
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let userId: string;
  try {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) throw new Error("No user");
    userId = user.id;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await req.json().catch(() => ({}));

    console.log(`Analyzing patterns for user: ${userId}`);

    // Fetch last 30 days of daily check-ins
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: checkins, error: checkinError } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", userId)
      .gte("checkin_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("checkin_date", { ascending: true });

    if (checkinError) throw checkinError;

    // Fetch tasks completed in last 30 days
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, completed, completed_at, category, priority")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("completed_at", thirtyDaysAgo.toISOString());

    if (tasksError) throw tasksError;

    // Fetch focus sessions
    const { data: focusSessions, error: focusError } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", thirtyDaysAgo.toISOString());

    if (focusError) throw focusError;

    // Fetch habit logs
    const { data: habitLogs, error: habitsError } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (habitsError) throw habitsError;

    // Analyze patterns
    const patterns: Record<string, unknown>[] = [];
    const now = new Date();

    // 1. Sleep-Productivity Correlation
    if (checkins && checkins.length >= 7) {
      const sleepProductivityData = checkins
        .filter((c) => c.sleep_hours && c.day_rating)
        .map((c) => ({ sleep: c.sleep_hours, rating: c.day_rating }));

      if (sleepProductivityData.length >= 5) {
        const goodSleepDays = sleepProductivityData.filter((d) => d.sleep >= 7);
        const badSleepDays = sleepProductivityData.filter((d) => d.sleep < 6);

        if (goodSleepDays.length >= 3 && badSleepDays.length >= 2) {
          const goodSleepAvgRating =
            goodSleepDays.reduce((acc, d) => acc + d.rating, 0) / goodSleepDays.length;
          const badSleepAvgRating =
            badSleepDays.reduce((acc, d) => acc + d.rating, 0) / badSleepDays.length;
          const diff = goodSleepAvgRating - badSleepAvgRating;

          if (diff > 0.5) {
            patterns.push({
              pattern_type: "correlation",
              category: "sleep",
              title: "Sleep Impacts Your Day",
              description: `When you sleep 7+ hours, your days are rated ${Math.round(diff * 20)}% higher on average.`,
              confidence_score: Math.min(0.9, 0.5 + checkins.length / 50),
              correlation_strength: diff / 4,
              variables: ["sleep_hours", "day_rating"],
              data_points: sleepProductivityData.slice(-7),
            });
          }
        }
      }
    }

    // 2. Energy-Task Completion Correlation
    if (checkins && tasks) {
      const energyTaskData = checkins
        .filter((c) => c.energy_level)
        .map((c) => {
          const date = c.checkin_date;
          const dayTasks = tasks.filter((t) => t.completed_at && t.completed_at.startsWith(date));
          return {
            energy: c.energy_level,
            tasksCompleted: dayTasks.length,
          };
        });

      const highEnergyDays = energyTaskData.filter((d) => d.energy === "high");
      const lowEnergyDays = energyTaskData.filter((d) => d.energy === "low");

      if (highEnergyDays.length >= 2 && lowEnergyDays.length >= 2) {
        const highEnergyAvg =
          highEnergyDays.reduce((acc, d) => acc + d.tasksCompleted, 0) / highEnergyDays.length;
        const lowEnergyAvg =
          lowEnergyDays.reduce((acc, d) => acc + d.tasksCompleted, 0) / lowEnergyDays.length;

        if (highEnergyAvg > lowEnergyAvg * 1.3) {
          patterns.push({
            pattern_type: "correlation",
            category: "productivity",
            title: "Energy Drives Productivity",
            description: `On high-energy days, you complete ${Math.round((highEnergyAvg / lowEnergyAvg - 1) * 100)}% more tasks.`,
            confidence_score: Math.min(0.85, 0.4 + energyTaskData.length / 40),
            correlation_strength: (highEnergyAvg - lowEnergyAvg) / highEnergyAvg,
            variables: ["energy_level", "tasks_completed"],
            data_points: energyTaskData.slice(-7),
          });
        }
      }
    }

    // 3. Mood Trend Detection
    if (checkins && checkins.length >= 7) {
      const moodData = checkins
        .filter((c) => c.mood)
        .map((c) => ({
          date: c.checkin_date,
          mood: c.mood,
          moodValue: getMoodValue(c.mood),
        }));

      if (moodData.length >= 5) {
        const recentMoods = moodData.slice(-7);
        const avgMood = recentMoods.reduce((acc, d) => acc + d.moodValue, 0) / recentMoods.length;

        const olderMoods = moodData.slice(-14, -7);
        if (olderMoods.length >= 5) {
          const olderAvg = olderMoods.reduce((acc, d) => acc + d.moodValue, 0) / olderMoods.length;
          const trend = avgMood - olderAvg;

          if (Math.abs(trend) > 0.5) {
            patterns.push({
              pattern_type: "trend",
              category: "mood",
              title: trend > 0 ? "Mood Improving! 📈" : "Mood Needs Attention",
              description:
                trend > 0
                  ? `Your mood has improved by ${Math.round(trend * 20)}% this week compared to last week.`
                  : `Your mood has declined slightly. Consider what might be affecting you.`,
              confidence_score: Math.min(0.8, 0.5 + moodData.length / 30),
              correlation_strength: Math.abs(trend) / 4,
              variables: ["mood"],
              data_points: recentMoods,
            });
          }
        }
      }
    }

    // 4. Focus Session Patterns
    if (focusSessions && focusSessions.length >= 5) {
      const completedSessions = focusSessions.filter((s) => s.is_completed);
      const completionRate = completedSessions.length / focusSessions.length;

      if (completionRate < 0.5 && focusSessions.length >= 8) {
        const avgDuration =
          focusSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / focusSessions.length;
        patterns.push({
          pattern_type: "anomaly",
          category: "productivity",
          title: "Focus Sessions Need Tuning",
          description: `Only ${Math.round(completionRate * 100)}% of focus sessions completed. Try shorter ${Math.round(avgDuration * 0.6)} min sessions.`,
          confidence_score: 0.75,
          correlation_strength: 1 - completionRate,
          variables: ["focus_sessions", "completion_rate"],
          data_points: focusSessions.slice(-5).map((s) => ({
            duration: s.duration_minutes,
            completed: s.is_completed,
          })),
        });
      }
    }

    // 5. Habit Streak Prediction
    if (habitLogs && habitLogs.length >= 7) {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      const todayLogs = habitLogs.filter((l) => l.log_date === today);
      const yesterdayLogs = habitLogs.filter((l) => l.log_date === yesterday);

      if (yesterdayLogs.length > 0 && todayLogs.length === 0) {
        patterns.push({
          pattern_type: "prediction",
          category: "general",
          title: "Keep Your Streaks! 🔥",
          description: `You completed ${yesterdayLogs.length} habit(s) yesterday but haven't logged today. Don't break the chain!`,
          confidence_score: 0.9,
          variables: ["habit_logs"],
          data_points: yesterdayLogs,
        });
      }
    }

    // Store new patterns
    if (patterns.length > 0) {
      for (const pattern of patterns) {
        // Check if similar pattern already exists
        const { data: existing } = await supabase
          .from("user_patterns")
          .select("id, times_detected")
          .eq("user_id", userId)
          .eq("title", pattern.title)
          .eq("is_active", true)
          .single();

        if (existing) {
          // Update existing pattern
          await supabase
            .from("user_patterns")
            .update({
              description: pattern.description,
              confidence_score: pattern.confidence_score,
              correlation_strength: pattern.correlation_strength,
              data_points: pattern.data_points,
              times_detected: existing.times_detected + 1,
              last_detected_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Insert new pattern
          await supabase.from("user_patterns").insert({
            user_id: userId,
            ...pattern,
            first_detected_at: now.toISOString(),
            last_detected_at: now.toISOString(),
          });
        }
      }
    }

    // Generate weekly summary if we have enough data
    const weekStart = getWeekStart(now);
    const { data: existingSummary } = await supabase
      .from("weekly_summaries")
      .select("id")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .single();

    if (!existingSummary && checkins && checkins.length >= 3) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekCheckins = checkins.filter((c) => {
        const d = new Date(c.checkin_date);
        return d >= new Date(weekStart) && d <= weekEnd;
      });

      const weekTasks =
        tasks?.filter((t) => {
          if (!t.completed_at) return false;
          const d = new Date(t.completed_at);
          return d >= new Date(weekStart) && d <= weekEnd;
        }) || [];

      const weekFocus =
        focusSessions?.filter((s) => {
          const d = new Date(s.started_at);
          return d >= new Date(weekStart) && d <= weekEnd;
        }) || [];

      const weekHabits =
        habitLogs?.filter((l) => {
          const d = new Date(l.log_date);
          return d >= new Date(weekStart) && d <= weekEnd;
        }) || [];

      await supabase.from("weekly_summaries").insert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd.toISOString().split("T")[0],
        tasks_completed: weekTasks.length,
        focus_minutes: weekFocus.reduce(
          (acc, s) => acc + (s.is_completed ? s.duration_minutes : 0),
          0,
        ),
        habits_completed: weekHabits.length,
        avg_mood:
          weekCheckins.length > 0
            ? weekCheckins.filter((c) => c.mood).reduce((acc, c) => acc + getMoodValue(c.mood), 0) /
              weekCheckins.filter((c) => c.mood).length
            : null,
        avg_energy:
          weekCheckins.length > 0
            ? weekCheckins
                .filter((c) => c.energy_level)
                .reduce((acc, c) => acc + getEnergyValue(c.energy_level), 0) /
              weekCheckins.filter((c) => c.energy_level).length
            : null,
        avg_sleep_hours:
          weekCheckins.length > 0
            ? weekCheckins.filter((c) => c.sleep_hours).reduce((acc, c) => acc + c.sleep_hours, 0) /
              weekCheckins.filter((c) => c.sleep_hours).length
            : null,
        patterns_detected: patterns.map((p) => ({ title: p.title, category: p.category })),
      });
    }

    console.log(`Analysis complete: ${patterns.length} patterns detected`);

    return new Response(
      JSON.stringify({
        success: true,
        patterns: patterns,
        patternsCount: patterns.length,
        dataPoints: {
          checkins: checkins?.length || 0,
          tasks: tasks?.length || 0,
          focusSessions: focusSessions?.length || 0,
          habitLogs: habitLogs?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Pattern analysis error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Helper functions
function getMoodValue(moodEmoji: string): number {
  const moodMap: Record<string, number> = {
    "😊": 5,
    "🙂": 4,
    "😐": 3,
    "😔": 2,
    "😤": 2,
    "😰": 1,
  };
  return moodMap[moodEmoji] || 3;
}

function getEnergyValue(energy: string): number {
  const energyMap: Record<string, number> = {
    high: 5,
    medium: 3,
    low: 1,
  };
  return energyMap[energy] || 3;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
