// Energy-aware scheduling suggestion. Reads recent mood/energy logs + calendar density,
// returns a short JSON suggestion the morning brief / dashboard can show.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: claimsData } = await supabaseAuth.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claimsData?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const future = new Date(now.getTime() + 7 * 86400_000).toISOString();

    const [checkinsRes, eventsRes, tasksRes] = await Promise.all([
      supabase.from("daily_checkins").select("checkin_date, mood, energy_level, sleep_hours, stress_level, day_rating").eq("user_id", userId).gte("checkin_date", past.slice(0, 10)).order("checkin_date", { ascending: false }),
      supabase.from("events").select("title, start_time, end_time, category").eq("user_id", userId).gte("start_time", now.toISOString()).lte("start_time", future).order("start_time"),
      supabase.from("tasks").select("title, priority, due_date, completed").eq("user_id", userId).eq("completed", false).limit(20),
    ]);

    // Compute density per day (next 7 days)
    const density: Record<string, number> = {};
    for (const e of eventsRes.data ?? []) {
      const day = e.start_time.slice(0, 10);
      density[day] = (density[day] ?? 0) + 1;
    }

    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an energy-aware scheduling coach. Combine recent energy/mood/sleep with calendar density to give ONE concise (2-3 sentence) suggestion for today. Identify low-energy patterns and suggest moving deep work to higher-energy days. Be encouraging, never preachy." },
          { role: "user", content: `Today: ${now.toISOString().slice(0, 10)}\n\nLast 7 days check-ins:\n${JSON.stringify(checkinsRes.data ?? [])}\n\nCalendar density next 7 days (date → meeting count):\n${JSON.stringify(density)}\n\nOpen high-priority tasks:\n${JSON.stringify((tasksRes.data ?? []).filter(t => t.priority === 'high'))}` },
        ],
      }),
    });
    if (!resp.ok) return new Response(JSON.stringify({ error: "AI failed" }), { status: 502, headers: corsHeaders });
    const data = await resp.json();
    const suggestion = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ suggestion, density, checkins: checkinsRes.data?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("energy-coach error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
