import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from "../_shared/cors.ts";
import { resolveUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Spouse Handoff: When a household task is created, route it to the family member
// who has the most calendar capacity in the next 24h.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // User-facing: authenticate the caller (the gateway does not verify JWTs).
  const auth = await resolveUserId(req);
  if (!auth) {
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
    const { task_id, group_id } = await req.json();
    if (!task_id || !group_id) {
      return new Response(JSON.stringify({ error: "task_id and group_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, category, user_id, due_date")
      .eq("id", task_id)
      .single();

    if (!task) {
      return new Response(JSON.stringify({ error: "task not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: members } = await supabase
      .from("family_agent_members")
      .select("user_id")
      .eq("group_id", group_id)
      .eq("status", "accepted");

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: "no members" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Authorize: both the caller AND the task's current owner must be accepted
    // members of the target group. Checking only the caller would still let a
    // valid login route an arbitrary task from another group into their own
    // (IDOR). Reuses the members list above — no extra query.
    const isCallerMember = members.some((m) => m.user_id === auth.userId);
    const isTaskOwnerMember = members.some((m) => m.user_id === task.user_id);
    if (!isCallerMember || !isTaskOwnerMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 3600_000).toISOString();

    let bestUser = task.user_id;
    let lowestLoad = Infinity;

    for (const m of members) {
      const { count: eventCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", m.user_id)
        .gte("start_time", now.toISOString())
        .lte("start_time", horizon);

      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", m.user_id)
        .eq("completed", false)
        .lte("due_date", horizon);

      const load = (eventCount || 0) + (taskCount || 0);
      if (load < lowestLoad) {
        lowestLoad = load;
        bestUser = m.user_id;
      }
    }

    if (bestUser !== task.user_id) {
      await supabase.from("tasks").update({ user_id: bestUser }).eq("id", task_id);
    }

    await supabase.from("mental_load_log").insert({
      group_id,
      handled_by: bestUser,
      category: task.category || "household",
      description: `Routed: ${task.title}`,
      source: "spouse_handoff",
      source_ref: task_id,
    });

    return new Response(
      JSON.stringify({ success: true, routed_to: bestUser, load_score: lowestLoad }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("spouse-handoff error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
