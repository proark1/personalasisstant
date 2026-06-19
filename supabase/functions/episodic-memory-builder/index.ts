import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build episodic memories from significant events: trips, milestones, important meetings
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal/cron only: the gateway does not verify JWTs for /functions/v1,
  // so require the service-role bearer in code (matches the *-cron siblings).
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    let userIds: string[] = body.user_id ? [body.user_id] : [];
    if (userIds.length === 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id");
      userIds = (profiles || []).map((p: { user_id: string }) => p.user_id);
    }

    let total = 0;

    for (const userId of userIds) {
      // 1. From detected trips
      const { data: trips } = await supabase
        .from("detected_trips")
        .select(
          "id, destination, destination_country, start_date, end_date, contacts_in_destination",
        )
        .eq("user_id", userId)
        .lte("end_date", new Date().toISOString().split("T")[0])
        .limit(20);

      for (const t of trips || []) {
        const ref = `trip:${t.id}`;
        const { data: existing } = await supabase
          .from("episodic_memories")
          .select("id")
          .eq("user_id", userId)
          .eq("source_ref", ref)
          .maybeSingle();
        if (existing) continue;

        const people = (t.contacts_in_destination as Array<{ name: string; id: string }>) || [];
        await supabase.from("episodic_memories").insert({
          user_id: userId,
          occurred_on: t.start_date,
          occurred_end: t.end_date,
          title: `Trip to ${t.destination}`,
          summary: `${dateRange(t.start_date, t.end_date)} in ${t.destination}${
            people.length
              ? ` — met ${people
                  .map((p) => p.name)
                  .slice(0, 3)
                  .join(", ")}`
              : ""
          }`,
          location: t.destination,
          location_country: t.destination_country,
          people: people.map((p) => ({ name: p.name, contact_id: p.id })),
          tags: ["travel"],
          source: "trip",
          source_ref: ref,
          importance: 4,
        });
        total++;
      }

      // 2. From completed goals
      const { data: goals } = await supabase
        .from("goals")
        .select("id, name, description, completed_at")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .not("completed_at", "is", null)
        .limit(20);

      for (const g of goals || []) {
        const ref = `goal:${g.id}`;
        const { data: existing } = await supabase
          .from("episodic_memories")
          .select("id")
          .eq("user_id", userId)
          .eq("source_ref", ref)
          .maybeSingle();
        if (existing) continue;

        await supabase.from("episodic_memories").insert({
          user_id: userId,
          occurred_on: g.completed_at!.split("T")[0],
          title: `Achieved goal: ${g.name}`,
          summary: g.description || `Completed goal "${g.name}"`,
          tags: ["milestone", "goal"],
          source: "goal",
          source_ref: ref,
          importance: 5,
        });
        total++;
      }

      // 3. From high-rated days
      const { data: greatDays } = await supabase
        .from("daily_checkins")
        .select("checkin_date, day_rating, went_well, gratitude_note, main_focus")
        .eq("user_id", userId)
        .gte("day_rating", 5)
        .limit(20);

      for (const d of greatDays || []) {
        const ref = `checkin:${d.checkin_date}`;
        const { data: existing } = await supabase
          .from("episodic_memories")
          .select("id")
          .eq("user_id", userId)
          .eq("source_ref", ref)
          .maybeSingle();
        if (existing) continue;

        const summary = [d.went_well, d.gratitude_note, d.main_focus].filter(Boolean).join(" • ");
        if (!summary) continue;

        await supabase.from("episodic_memories").insert({
          user_id: userId,
          occurred_on: d.checkin_date,
          title: `Great day (${d.day_rating}/5)`,
          summary,
          tags: ["positive", "checkin"],
          source: "checkin",
          source_ref: ref,
          importance: 3,
        });
        total++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, memoriesCreated: total, usersScanned: userIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("episodic-memory-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function dateRange(start: string, end: string): string {
  if (start === end) return start;
  return `${start} → ${end}`;
}
