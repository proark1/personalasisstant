// Admin-only "export the whole database" endpoint. The client orchestrates
// the export table-by-table (and page-by-page within a table) so the edge
// function never has to hold a full database snapshot in memory — each
// request returns at most one page of one table.
//
// Actions:
//   list_tables       → [{ table, estimated_rows }] for every public table
//   export_table      → { rows, has_more, next_offset } for one page
//   export_auth_users → auth.users page (page, perPage)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { strictAppOrigin } from "../_shared/cors.ts";

// Echo the caller's Origin instead of pinning to APP_URL — preview
// deploys can land on rotating subdomains, and a static APP_URL
// breaks every preview's CORS preflight. We still gate access via the
// admin JWT check below, so the echoed origin doesn't open up anything
// that wasn't already protected.
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || strictAppOrigin();
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin", {
      check_user_id: userData.user.id,
    });
    if (adminErr || !isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = (body?.action ?? "list_tables") as string;

    if (action === "list_tables") {
      const { data, error } = await admin.rpc("admin_list_public_tables");
      if (error) throw error;
      return json({ tables: data ?? [] });
    }

    if (action === "export_table") {
      const table = String(body?.table ?? "").trim();
      // 1000 is the Supabase REST default ceiling per request. Larger
      // values are silently capped, so don't pretend we can ask for more.
      const limit = Math.min(Math.max(Number(body?.limit ?? 500), 1), 1000);
      const offset = Math.max(Number(body?.offset ?? 0), 0);
      if (!table) return json({ error: "table required" }, 400);

      // Order by a deterministic column when available so pagination is
      // stable across calls. We prefer the first column of the primary key,
      // falling back to no ordering when the table has none (rare).
      const { data: pk } = await admin.rpc("admin_table_primary_key", { p_table: table });
      const pkCols = (pk as string[] | null) ?? [];

      let query = admin.from(table).select("*", { count: "exact" });
      for (const col of pkCols) {
        query = query.order(col, { ascending: true });
      }
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const total = count ?? 0;
      const nextOffset = offset + rows.length;
      return json({
        table,
        rows,
        offset,
        returned: rows.length,
        total,
        has_more: nextOffset < total && rows.length === limit,
        next_offset: nextOffset,
        primary_key: pkCols,
      });
    }

    if (action === "export_auth_users") {
      // listUsers paginates by page (1-indexed) and perPage (max 1000).
      const page = Math.max(Number(body?.page ?? 1), 1);
      const perPage = Math.min(Math.max(Number(body?.per_page ?? 200), 1), 1000);
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      // Strip the encrypted_password / phone_change_token-style internals
      // even from the admin export — re-importing a hash from this project
      // into another doesn't work anyway, and shipping it widens the blast
      // radius if the file leaks.
      const users = (data.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        confirmed_at: u.confirmed_at,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: u.phone_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        role: u.role,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
        is_anonymous: (u as { is_anonymous?: boolean }).is_anonymous,
      }));
      return json({
        users,
        page,
        per_page: perPage,
        returned: users.length,
        has_more: users.length === perPage,
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("admin-data-export error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
