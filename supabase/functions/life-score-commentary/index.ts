import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    let userIds: string[] = body.user_id ? [body.user_id] : [];
    if (userIds.length === 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id");
      userIds = (profiles || []).map((p: any) => p.user_id);
    }

    const today = new Date().toISOString().split("T")[0];
    let total = 0;

    for (const userId of userIds) {
      // Skip if commentary already exists today
      const { data: existing } = await supabase
        .from("life_score_commentary")
        .select("id")
        .eq("user_id", userId)
        .eq("observation_date", today)
        .maybeSingle();
      if (existing) continue;

      // Compute today's score from daily_checkins + recent activity
      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select("checkin_date, day_rating, mood, energy_level, sleep_hours, sleep_quality, stress_level")
        .eq("user_id", userId)
        .order("checkin_date", { ascending: false })
        .limit(7);

      if (!checkins || checkins.length < 2) continue;

      const todayScore = computeScore(checkins[0]);
      const prevScore = computeScore(checkins[1]);
      if (todayScore == null || prevScore == null) continue;

      const delta = todayScore - prevScore;
      const trend = delta > 5 ? "up" : delta < -5 ? "down" : "flat";

      const factors = identifyFactors(checkins[0], checkins[1]);

      const aiPayload = await callGemini(checkins, todayScore, prevScore, factors);

      await supabase.from("life_score_commentary").insert({
        user_id: userId,
        observation_date: today,
        current_score: todayScore,
        previous_score: prevScore,
        delta,
        trend,
        headline: aiPayload.headline,
        commentary: aiPayload.commentary,
        contributing_factors: factors,
        suggestions: aiPayload.suggestions,
      });
      total++;
    }

    return new Response(
      JSON.stringify({ success: true, commentariesCreated: total, usersScanned: userIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("life-score-commentary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function computeScore(c: any): number | null {
  if (!c) return null;
  const parts: number[] = [];
  if (c.day_rating) parts.push(c.day_rating * 20);
  if (c.sleep_hours) parts.push(Math.min(100, (c.sleep_hours / 8) * 100));
  if (c.sleep_quality) parts.push(c.sleep_quality * 20);
  if (c.stress_level) parts.push(Math.max(0, 100 - c.stress_level * 20));
  if (c.energy_level) {
    const map: Record<string, number> = { high: 90, medium: 60, low: 30 };
    parts.push(map[c.energy_level] ?? 50);
  }
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function identifyFactors(today: any, prev: any): Array<{ factor: string; change: string }> {
  const factors: Array<{ factor: string; change: string }> = [];
  if (today.sleep_hours && prev.sleep_hours) {
    const diff = today.sleep_hours - prev.sleep_hours;
    if (Math.abs(diff) >= 1) factors.push({ factor: "sleep", change: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}h` });
  }
  if (today.energy_level !== prev.energy_level) {
    factors.push({ factor: "energy", change: `${prev.energy_level} → ${today.energy_level}` });
  }
  if (today.stress_level && prev.stress_level) {
    const diff = today.stress_level - prev.stress_level;
    if (Math.abs(diff) >= 1) factors.push({ factor: "stress", change: `${diff > 0 ? "+" : ""}${diff}` });
  }
  return factors;
}

async function callGemini(
  checkins: any[],
  todayScore: number,
  prevScore: number,
  factors: any[],
): Promise<{ headline: string; commentary: string; suggestions: any[] }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return {
      headline: todayScore > prevScore ? "Trending up" : "Slight dip",
      commentary: `Life score moved from ${prevScore} to ${todayScore}.`,
      suggestions: [],
    };
  }

  const prompt = `User Life Score: today ${todayScore}, yesterday ${prevScore}. Factors: ${JSON.stringify(factors)}. Recent checkins: ${JSON.stringify(checkins.slice(0, 3))}. Write a SHORT (max 2 sentence) commentary as Dori (warm, direct, German-context personal assistant). Return JSON: { "headline": "5-7 word headline", "commentary": "1-2 sentences", "suggestions": [{"label": "...", "action": "..."}] (0-2 items)}.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Dori, a warm personal assistant. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      headline: parsed.headline || "Life score update",
      commentary: parsed.commentary || `From ${prevScore} to ${todayScore}.`,
      suggestions: parsed.suggestions || [],
    };
  } catch (e) {
    console.error("gemini error:", e);
    return {
      headline: "Life score update",
      commentary: `Score: ${prevScore} → ${todayScore}.`,
      suggestions: [],
    };
  }
}
