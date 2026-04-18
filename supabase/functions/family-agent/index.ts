import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Family agent: handles invites, accepts, and group creation in one place.
// Actions: 'create_group', 'invite_member', 'accept_invite', 'list_load_summary'
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, payload } = await req.json();

    if (action === "create_group") {
      const { data: group, error } = await service
        .from("family_agent_groups")
        .insert({
          owner_id: user.id,
          name: payload?.name || "Family",
          telegram_chat_id: payload?.telegram_chat_id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-add owner as accepted member
      await service.from("family_agent_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "owner",
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });

      return json({ success: true, group });
    }

    if (action === "invite_member") {
      const { group_id, email } = payload;
      const { data: profile } = await service
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      if (!profile) return json({ error: "User not found" }, 404);

      const { data, error } = await service
        .from("family_agent_members")
        .insert({ group_id, user_id: profile.user_id, role: "member", status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return json({ success: true, member: data });
    }

    if (action === "accept_invite") {
      const { member_id } = payload;
      const { error } = await service
        .from("family_agent_members")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", member_id)
        .eq("user_id", user.id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "load_summary") {
      const { group_id, days = 30 } = payload;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: rows } = await service
        .from("mental_load_log")
        .select("handled_by, weight, category")
        .eq("group_id", group_id)
        .gte("occurred_at", since);

      const totals = new Map<string, { total: number; categories: Record<string, number> }>();
      for (const r of rows || []) {
        const cur = totals.get(r.handled_by) || { total: 0, categories: {} };
        cur.total += r.weight || 1;
        cur.categories[r.category] = (cur.categories[r.category] || 0) + (r.weight || 1);
        totals.set(r.handled_by, cur);
      }

      return json({
        success: true,
        days,
        breakdown: Array.from(totals.entries()).map(([uid, v]) => ({ user_id: uid, ...v })),
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("family-agent error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
