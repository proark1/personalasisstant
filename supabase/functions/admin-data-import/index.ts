// Admin-only "load a previous export back into the database" endpoint.
// The client uploads the bundle, then drives the import table-by-table
// (and chunked within each table) so we can report progress and stay
// inside the edge function memory budget on huge dumps.
//
// Actions:
//   list_tables       → mirror of the export endpoint, so callers can sanity-check
//   import_table      → upsert (or replace) one chunk of rows for one table
//   import_auth_users → re-create auth.users entries that don't already exist
//   wipe_table        → DELETE everything from one table (used in 'replace' mode)
//
// Safety: every write path checks is_admin(auth.uid()) up front. The
// import is best-effort per row — one bad row won't abort the chunk, it
// just shows up in the error list returned to the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { strictAppOrigin } from '../_shared/cors.ts';

// Echo the caller's Origin so preview deploys on rotating subdomains
// all pass the CORS preflight. Admin JWT check below still gates every action.
function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || strictAppOrigin();
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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
    const action = (body?.action ?? "") as string;

    if (action === "list_tables") {
      const { data, error } = await admin.rpc("admin_list_public_tables");
      if (error) throw error;
      return json({ tables: data ?? [] });
    }

    if (action === "wipe_table") {
      const table = String(body?.table ?? "").trim();
      if (!table) return json({ error: "table required" }, 400);
      // admin_truncate_table is a SECURITY DEFINER function that runs a
      // real TRUNCATE — much faster than DELETE on big tables and
      // sidesteps PostgREST's "every delete needs a filter" rule. It
      // also re-checks the admin guard and refuses protected tables.
      const { error } = await admin.rpc("admin_truncate_table", { p_table: table });
      if (error) return json({ error: error.message }, 400);
      return json({ table, wiped: true });
    }

    if (action === "import_table") {
      const table = String(body?.table ?? "").trim();
      const rows = Array.isArray(body?.rows) ? (body.rows as Record<string, unknown>[]) : [];
      const mode = (body?.mode ?? "upsert") as "upsert" | "insert";
      const onConflict = body?.on_conflict as string | undefined;
      if (!table) return json({ error: "table required" }, 400);

      // Validate the target lives in public and isn't a protected
      // infrastructure table. is_admin gates this whole function, but
      // an admin shouldn't be able to bricl the panel by importing into
      // admin_users either — and admin.from('schema_name.table') would
      // happily resolve a schema-qualified identifier we never meant
      // to support.
      const PROTECTED = new Set(["admin_users", "schema_migrations"]);
      if (PROTECTED.has(table)) {
        return json({ error: `refusing to import into protected table: ${table}` }, 400);
      }
      const { data: knownTables, error: listErr } = await admin.rpc("admin_list_public_tables");
      if (listErr) return json({ error: listErr.message }, 500);
      const allowed = new Set(
        ((knownTables as { table_name: string }[] | null) ?? []).map((t) => t.table_name),
      );
      if (!allowed.has(table)) {
        return json({ error: `unknown public table: ${table}` }, 400);
      }

      if (rows.length === 0) {
        return json({ table, inserted: 0, errors: [] });
      }

      // Try one bulk operation first — it's an order of magnitude faster
      // than row-by-row. If the bulk write fails (FK violation, duplicate
      // key, etc.), fall back to per-row so a single bad record doesn't
      // sink the whole chunk and we can pinpoint what failed.
      let bulkErr: string | null = null;
      try {
        if (mode === "insert") {
          const { error } = await admin.from(table).insert(rows);
          if (error) bulkErr = error.message;
        } else {
          const { error } = await admin.from(table).upsert(rows, {
            onConflict,
            ignoreDuplicates: false,
          });
          if (error) bulkErr = error.message;
        }
      } catch (e) {
        bulkErr = e instanceof Error ? e.message : String(e);
      }

      if (!bulkErr) {
        return json({ table, inserted: rows.length, errors: [] });
      }

      const errors: { index: number; message: string }[] = [];
      let inserted = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (mode === "insert") {
            const { error } = await admin.from(table).insert([row]);
            if (error) throw error;
          } else {
            const { error } = await admin.from(table).upsert([row], {
              onConflict,
              ignoreDuplicates: false,
            });
            if (error) throw error;
          }
          inserted++;
        } catch (e) {
          errors.push({
            index: i,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return json({ table, inserted, errors, bulk_error: bulkErr });
    }

    if (action === "import_auth_users") {
      const users = Array.isArray(body?.users) ? (body.users as Record<string, unknown>[]) : [];
      if (users.length === 0) return json({ created: 0, skipped: 0, errors: [] });

      const errors: { id: string; message: string }[] = [];
      let created = 0;
      let skipped = 0;

      for (const u of users) {
        const id = String(u.id ?? "");
        if (!id) {
          errors.push({ id: "(missing)", message: "user has no id" });
          continue;
        }
        try {
          // Just attempt the create — the admin API returns a
          // recognisable error when the id/email is already present, and
          // a single round-trip beats the previous getUserById + create
          // N+1 by half. We preserve the original id so all the FK
          // references in public.* line up with the imported rows.
          const { error } = await admin.auth.admin.createUser({
            id,
            email: (u.email as string | undefined) ?? undefined,
            phone: (u.phone as string | undefined) ?? undefined,
            email_confirm: Boolean(u.email_confirmed_at),
            phone_confirm: Boolean(u.phone_confirmed_at),
            app_metadata: (u.app_metadata as Record<string, unknown>) ?? {},
            user_metadata: (u.user_metadata as Record<string, unknown>) ?? {},
          });
          if (error) {
            // Supabase surfaces "already exists" as status 422 with one
            // of a couple of stable codes; treat any of them as a skip.
            const code = (error as { code?: string; status?: number }).code;
            const status = (error as { status?: number }).status;
            const msg = (error.message || "").toLowerCase();
            const isDuplicate =
              code === "email_exists" ||
              code === "phone_exists" ||
              code === "user_already_exists" ||
              status === 422 ||
              msg.includes("already") ||
              msg.includes("duplicate");
            if (isDuplicate) {
              skipped++;
            } else {
              throw error;
            }
          } else {
            created++;
          }
        } catch (e) {
          errors.push({ id, message: e instanceof Error ? e.message : String(e) });
        }
      }

      return json({ created, skipped, errors });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("admin-data-import error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
