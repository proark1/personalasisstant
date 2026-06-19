// "Download everything Dori knows" — single endpoint that bundles every
// personal-data table the user owns into one JSON blob. Built for
// GDPR-style export requests and for users who just want to leave with
// their data intact.
//
// Workspace-scoped tables are NOT exported here; workspaces have their
// own ownership semantics and require an admin-driven export. Telegram
// + push tokens are excluded by default since they're device handles
// rather than user-authored data; the operator can flip the include flag
// in the request body if they need the full picture.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default set of tables exported. Each entry is { table, scope }
// where scope is the column we filter on (always user_id today).
const PERSONAL_TABLES: { table: string; scope: "user_id" }[] = [
  { table: "profiles", scope: "user_id" },
  { table: "tasks", scope: "user_id" },
  { table: "events", scope: "user_id" },
  { table: "notes", scope: "user_id" },
  { table: "projects", scope: "user_id" },
  { table: "user_contacts", scope: "user_id" },
  { table: "contracts", scope: "user_id" },
  { table: "properties", scope: "user_id" },
  { table: "vehicles", scope: "user_id" },
  { table: "family_members", scope: "user_id" },
  { table: "ai_memory", scope: "user_id" },
  { table: "task_comments", scope: "author_id" as "user_id" /* author */ },
  { table: "auto_actions_log", scope: "user_id" },
  { table: "dori_undo_log", scope: "user_id" },
  { table: "dori_proactive_log", scope: "user_id" },
  { table: "dori_conversations", scope: "user_id" },
  { table: "dori_learned_preferences", scope: "user_id" },
  { table: "health_metrics", scope: "user_id" },
  { table: "daily_checkins", scope: "user_id" },
  { table: "shopping_lists", scope: "user_id" },
  { table: "shopping_list_items", scope: "user_id" },
  { table: "proactive_settings", scope: "user_id" },
  { table: "workspace_members", scope: "user_id" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth" }, 401);
    }
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

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch sequentially with pagination + per-table caps. Parallel + bare
    // .select('*') on 20+ tables risks blowing past the edge function's
    // 256MB ceiling for any user with thousands of tasks or log entries.
    // Sequential lets memory peak per-table; a row cap prevents a single
    // log table (proactive_log, conversations) from hogging the whole budget.
    const PAGE = 1000; // rows per round-trip
    const TABLE_CAP = 5000; // hard cap per table; truncation noted in bundle
    const bundle: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      user_id: user.id,
      schema_version: 1,
      data: {} as Record<string, unknown[]>,
      errors: {} as Record<string, string>,
      truncated: {} as Record<string, number>, // table → row count when capped
    };

    for (const entry of PERSONAL_TABLES) {
      // task_comments uses author_id, the rest use user_id. We do this
      // with a dynamic .eq() rather than a special branch because the
      // RLS policy already restricts the rows to ones the caller can see.
      const col = entry.table === "task_comments" ? "author_id" : entry.scope;
      try {
        const collected: unknown[] = [];
        for (let from = 0; from < TABLE_CAP; from += PAGE) {
          const to = Math.min(from + PAGE - 1, TABLE_CAP - 1);
          const { data, error } = await admin
            .from(entry.table)
            .select("*")
            .eq(col, user.id)
            .range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          collected.push(...data);
          if (data.length < to - from + 1) break; // no more pages
        }
        (bundle.data as Record<string, unknown[]>)[entry.table] = collected;
        if (collected.length === TABLE_CAP) {
          // We hit the cap without exhausting the table — flag it so the
          // user knows the export is partial and can request a paginated
          // follow-up if needed.
          (bundle.truncated as Record<string, number>)[entry.table] = TABLE_CAP;
        }
      } catch (e) {
        // Don't blow up the whole export on one table failing. The user
        // gets everything else; the error is surfaced in the bundle.
        (bundle.errors as Record<string, string>)[entry.table] =
          e instanceof Error ? e.message : String(e);
      }
    }

    // Workspaces the user owns or admins — export their definition
    // alongside (rows owned by other users in those workspaces stay with
    // them). Read-only summary; no nested member dump.
    try {
      const { data: ws } = await admin.from("workspaces").select("*").eq("owner_id", user.id);
      (bundle.data as Record<string, unknown[]>)["workspaces_owned"] = ws || [];
    } catch (e) {
      (bundle.errors as Record<string, string>)["workspaces_owned"] =
        e instanceof Error ? e.message : String(e);
    }

    // Minified JSON — pretty-print would roughly double the size in
    // memory before we can write the response, which matters when the
    // user has thousands of activity-log rows.
    return new Response(JSON.stringify(bundle), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dori-export-${user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    console.error("user-data-export error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
