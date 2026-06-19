import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

interface Task {
  title: string;
  category: string;
  priority: string;
  completed: boolean;
  dueDate?: string;
}

interface Checkin {
  mood?: string;
  energy_level?: string;
  sleep_hours?: number;
  day_rating?: number;
}

interface ReviewRequest {
  tasks: Task[];
  focusMinutes: number;
  completionRate: number;
  checkins: Checkin[];
  weekStartDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error,
    } = await _sb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { tasks, focusMinutes, completionRate, checkins, weekStartDate }: ReviewRequest =
      await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const completedTasks = tasks.filter((t) => t.completed);
    const highPriorityCompleted = completedTasks.filter((t) => t.priority === "high").length;

    // Calculate mood average
    const moodScores: Record<string, number> = {
      great: 5,
      good: 4,
      okay: 3,
      stressed: 2,
      tired: 1,
    };
    const avgMood =
      checkins.length > 0
        ? checkins.reduce((sum, c) => sum + (moodScores[c.mood || "okay"] || 3), 0) /
          checkins.length
        : 3;

    const systemPrompt = `You are a supportive productivity coach analyzing someone's weekly performance.
Your goal is to provide encouragement while offering actionable insights.

Return a JSON object with this exact structure:
{
  "achievements": ["2-3 specific achievements to celebrate"],
  "patterns": ["2-3 observed patterns in their work/life"],
  "areasForImprovement": ["1-2 gentle suggestions for improvement"],
  "weeklyScore": <number 0-100 based on overall performance>,
  "personalizedTip": "One specific, actionable tip for next week",
  "nextWeekSuggestions": ["2-3 focus areas for next week"]
}

Guidelines:
- Be encouraging and positive first, then constructive
- Focus on progress, not perfection
- Acknowledge effort even if results weren't ideal
- Make suggestions specific and actionable
- If they had a tough week, be extra supportive
- Celebrate small wins`;

    const userPrompt = `Analyze this week's performance (starting ${weekStartDate}):

Task Performance:
- Total tasks: ${tasks.length}
- Completed: ${completedTasks.length} (${completionRate}% completion rate)
- High priority completed: ${highPriorityCompleted}
- Categories: ${[...new Set(tasks.map((t) => t.category))].join(", ")}

Focus & Productivity:
- Total focus minutes: ${focusMinutes}
- Check-ins recorded: ${checkins.length}
- Average mood score: ${avgMood.toFixed(1)}/5

Sample completed tasks:
${completedTasks
  .slice(0, 5)
  .map((t) => `- ${t.title} (${t.category}, ${t.priority} priority)`)
  .join("\n")}

Provide a supportive weekly review with achievements, patterns, and suggestions.`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Fallback with defaults
      result = {
        achievements: ["You showed up and kept going! 💪"],
        patterns: ["Your consistency is building momentum."],
        areasForImprovement: ["Try breaking large tasks into smaller chunks."],
        weeklyScore: Math.min(100, completionRate + Math.floor(focusMinutes / 10)),
        personalizedTip: "Start each day by completing one small task to build momentum.",
        nextWeekSuggestions: ["Focus on high-priority tasks first", "Take regular breaks"],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weekly review error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        // Provide fallback data so UI still works
        achievements: ["You're making progress!"],
        patterns: [],
        areasForImprovement: [],
        weeklyScore: 50,
        personalizedTip: "Keep going, you're doing great!",
        nextWeekSuggestions: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
