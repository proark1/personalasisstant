// First-day magic. Takes a short intake payload from the onboarding UI and
// seeds the account so the user's first open of the dashboard actually has
// content in it:
//   - display_name / timezone on profiles
//   - 3 starter tasks from "what's top of mind?"
// Marks onboarding_completed + stashes a timestamp in proactive_settings
// so the dashboard checklist knows the baseline is done.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeedInput {
  display_name?: string;
  timezone?: string;
  top_of_mind?: string[]; // up to ~5 free-text items → starter tasks
  role?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: uErr,
    } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const input = (await req.json().catch(() => ({}))) as SeedInput;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Update the profile with anything the user gave us.
    const profilePatch: Record<string, unknown> = { onboarding_completed: true };
    if (input.display_name?.trim()) profilePatch.display_name = input.display_name.trim();
    if (input.timezone?.trim()) profilePatch.timezone = input.timezone.trim();
    if (input.role?.trim()) profilePatch.role = input.role.trim();
    const { error: pErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", user.id);
    if (pErr) throw pErr; // otherwise we'd mark onboarding complete with no profile data saved

    // 2) Seed 3 starter tasks from the top-of-mind bucket. We keep it
    // small on purpose — too many tasks on day 1 is noise, not value.
    const tasksToCreate = (input.top_of_mind || [])
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .slice(0, 3);
    let createdTasks = 0;
    if (tasksToCreate.length) {
      const rows = tasksToCreate.map((title) => ({
        user_id: user.id,
        title,
        category: "personal",
        priority: "medium",
      }));
      const { error: tErr } = await admin.from("tasks").insert(rows);
      if (!tErr) createdTasks = rows.length;
    }

    // 3) Make sure proactive_settings exists with a baseline so the
    // dashboard checklist can be dismissed later.
    const { error: sErr } = await admin.from("proactive_settings").upsert(
      {
        user_id: user.id,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (sErr) throw sErr; // dismissal flow relies on this row existing

    return json({ ok: true, created_tasks: createdTasks });
  } catch (e) {
    console.error("dori-onboarding-seed error", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
