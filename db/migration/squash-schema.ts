#!/usr/bin/env bun
/**
 * Read every supabase/migrations/*.sql in chronological (filename) order,
 * strip Supabase-specific statements, rewrite auth.users FKs to public.users,
 * and emit a single self-contained bootstrap file at db/bootstrap/02_app_schema.sql.
 *
 * Why a script and not a hand-written squash?
 *   * 135 migration files with 214 CREATE TABLE statements and ~1046 RLS
 *     policies — hand-squashing risks dropping a column.
 *   * The migration history keeps growing; re-running this script keeps the
 *     bootstrap in sync with whatever has landed since.
 *   * The transformation rules live in one place (this file) so they can
 *     be audited.
 *
 * What gets STRIPPED (Supabase-only):
 *   * CREATE/ALTER/DROP POLICY (RLS — replaced by application-layer filters)
 *   * ALTER TABLE ... ENABLE/DISABLE/FORCE ROW LEVEL SECURITY
 *   * Any statement that references the `storage`, `vault`, `realtime`,
 *     `net`, `extensions`, or `cron` schemas
 *   * ALTER PUBLICATION supabase_realtime ... (replaced in a later phase
 *     with our own websocket / SSE layer)
 *   * CREATE EXTENSION pg_net (out of catalog on vanilla Postgres)
 *   * Triggers named on_auth_user_* (firing on auth.users) — the equivalent
 *     "insert profile row on signup" behaviour moves into our Auth.js signup callback
 *
 * What gets REWRITTEN:
 *   * `REFERENCES auth.users(id)` → `REFERENCES public.users(id)` (FKs continue
 *     to resolve once data is migrated into Auth.js's users table with preserved IDs)
 *   * `auth.uid()` calls in DEFAULT / GENERATED expressions → NULL with a TODO
 *     comment (these are vanishingly rare outside policy bodies)
 *
 * Run:  bun db/migration/squash-schema.ts
 * Output: db/bootstrap/02_app_schema.sql
 *
 * The output is committed so the bootstrap is reproducible without re-running
 * this script in CI.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const outFile = join(repoRoot, "db", "bootstrap", "02_app_schema.sql");

// ──────────────────────────────────────────────────────────────────────────────
// SQL statement splitter
// ──────────────────────────────────────────────────────────────────────────────
//
// Postgres statements are separated by `;`, but a `;` inside a string literal,
// quoted identifier, or `$tag$ ... $tag$` block doesn't terminate. We track
// those states in a small char-by-char loop.
//
// We DO NOT try to be a full parser — every transformation downstream
// operates on whole statements (string-level), and the splitter just needs
// to chunk correctly.

function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const c = sql[i];
    const next2 = sql.slice(i, i + 2);

    // Line comment — copy to end-of-line
    if (next2 === "--") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? len : nl + 1;
      cur += sql.slice(i, end);
      i = end;
      continue;
    }

    // Block comment — copy through closing */
    if (next2 === "/*") {
      const close = sql.indexOf("*/", i + 2);
      const end = close === -1 ? len : close + 2;
      cur += sql.slice(i, end);
      i = end;
      continue;
    }

    // Single-quoted string literal — handle '' escape
    if (c === "'") {
      cur += c;
      i++;
      while (i < len) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          cur += "''";
          i += 2;
          continue;
        }
        cur += sql[i];
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Double-quoted identifier — handle "" escape (Postgres doubles the
    // quote inside a quoted identifier the same way single-quoted strings
    // double the apostrophe).
    if (c === '"') {
      cur += c;
      i++;
      while (i < len) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          cur += '""';
          i += 2;
          continue;
        }
        cur += sql[i];
        if (sql[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Dollar-quoted block: $tag$ ... $tag$
    if (c === "$") {
      const tagMatch = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        const closeIdx = sql.indexOf(tag, i + tag.length);
        const end = closeIdx === -1 ? len : closeIdx + tag.length;
        cur += sql.slice(i, end);
        i = end;
        continue;
      }
    }

    // Statement terminator
    if (c === ";") {
      cur += ";";
      const trimmed = cur.trim();
      if (trimmed.length > 0) out.push(trimmed);
      cur = "";
      i++;
      continue;
    }

    cur += c;
    i++;
  }

  const tail = cur.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Filters & rewriters
// ──────────────────────────────────────────────────────────────────────────────

// Strip the leading comment block and whitespace so the keyword check works
// against the actual statement, not its prelude.
function statementHead(stmt: string): string {
  return stmt
    .replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s))+/, "")
    .trimStart()
    .toUpperCase();
}

function shouldSkip(stmt: string): boolean {
  const head = statementHead(stmt);

  // RLS — policies and the table-level toggle.
  if (/^(CREATE|ALTER|DROP)\s+POLICY\b/.test(head)) return true;
  if (/^ALTER\s+TABLE\b.*\b(ENABLE|DISABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b/.test(head))
    return true;

  // REVOKE/GRANT on a function — would fail with "function does not exist"
  // when the CREATE FUNCTION was stripped because its body referenced a
  // Supabase-only schema (cron./storage./etc.). These statements are security
  // hardening; actual access on the self-hosted stack is controlled by the
  // public-schema role GRANTs in 03_rls_policies.sql.
  if (/^(REVOKE|GRANT)\b.*\bON\s+FUNCTION\b/.test(head)) return true;

  // Realtime publications.
  if (/^(ALTER|CREATE|DROP)\s+PUBLICATION\b/.test(head)) return true;

  // Supabase-only extensions. Match against `head` so leading comments
  // can't sneak past the ^ anchor; `head` is uppercased.
  if (/^CREATE\s+EXTENSION\b.*\bPG_NET\b/.test(head)) return true;
  if (/^CREATE\s+EXTENSION\b.*\bSUPABASE_VAULT\b/.test(head)) return true;

  // Anything touching Supabase-managed schemas. Strip SQL comments first so
  // prose like "…rotate through Vault." (sentence period) in a column comment
  // doesn't get treated as a schema-qualified reference — that bug stripped
  // the bank_connections CREATE TABLE because of a "Vault." in its comments.
  const noComments = stmt.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  if (/\b(storage|vault|realtime|net|extensions|cron)\s*\./i.test(noComments) && true) {
    // Allow EXTENSION statements that target `extensions` schema — except
    // pg_net which we already excluded above.
    if (/^CREATE\s+EXTENSION\b/i.test(head)) {
      return /\bpg_net\b/i.test(stmt) || /\bsupabase_vault\b/i.test(stmt);
    }
    return true;
  }

  // Triggers that fire on auth.users — handled in the app layer post-migration.
  if (/^CREATE\s+TRIGGER\b/.test(head) && /\bauth\s*\.\s*users\b/i.test(stmt)) return true;
  if (/^DROP\s+TRIGGER\b/.test(head) && /\bauth\s*\.\s*users\b/i.test(stmt)) return true;

  // GRANT / REVOKE on auth/storage roles — Supabase-specific.
  if (
    /^(GRANT|REVOKE)\b/.test(head) &&
    /\b(anon|authenticated|service_role|supabase_admin|supabase_auth_admin|authenticator)\b/i.test(
      stmt,
    )
  ) {
    return true;
  }

  return false;
}

function rewrite(stmt: string): string {
  let out = stmt;

  // FKs: REFERENCES auth.users(id) → REFERENCES public.users(id)
  out = out.replace(
    /REFERENCES\s+auth\s*\.\s*users\s*\(\s*id\s*\)/gi,
    "REFERENCES public.users(id)",
  );
  out = out.replace(/REFERENCES\s+auth\s*\.\s*users\b/gi, "REFERENCES public.users");

  // CREATE TRIGGER → CREATE OR REPLACE TRIGGER (PG 14+). The squash output
  // contains overlapping migrations that re-define the same trigger, and
  // CREATE TRIGGER has no IF NOT EXISTS — without OR REPLACE the bootstrap
  // fails on the second occurrence with "trigger already exists." Railway
  // Postgres is 14+, so OR REPLACE is supported.
  if (/^CREATE\s+TRIGGER\b/.test(statementHead(stmt))) {
    // Case-SENSITIVE so we hit the uppercase SQL keyword and not lowercase
    // English in comments like "-- Create trigger for projects updated_at".
    out = out.replace(/\bCREATE\s+TRIGGER\b/, "CREATE OR REPLACE TRIGGER");
  }

  // auth.uid() / auth.role() outside policy bodies — these survive into
  // function bodies, CHECK constraints, DEFAULTs. Replace with NULL and
  // annotate so a human can review the call site later.
  if (/\bauth\s*\.\s*uid\s*\(\s*\)/i.test(out)) {
    out = out.replace(
      /\bauth\s*\.\s*uid\s*\(\s*\)/gi,
      "NULL /* TODO(auth-migration): was auth.uid() */",
    );
  }
  if (/\bauth\s*\.\s*role\s*\(\s*\)/i.test(out)) {
    out = out.replace(
      /\bauth\s*\.\s*role\s*\(\s*\)/gi,
      "'authenticated' /* TODO(auth-migration): was auth.role() */",
    );
  }

  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// RLS reconstitution (for the self-hosted PostgREST + GoTrue stack)
// ──────────────────────────────────────────────────────────────────────────────
// The data API is PostgREST and auth is GoTrue, both of which enforce per-user
// access through Postgres RLS + JWT claims — so we re-emit the policies the
// squash strips into a separate 03_rls_policies.sql. Unlike rewrite(), auth.uid()
// / auth.role() are KEPT here (we define them in the prelude); only the
// auth.users FK form is repointed at public.users.

const rlsOutFile = join(dirname(outFile), "03_rls_policies.sql");

function isRlsStatement(stmt: string): boolean {
  const head = statementHead(stmt);
  if (/^(CREATE|ALTER|DROP)\s+POLICY\b/.test(head)) return true;
  if (/^ALTER\s+TABLE\b.*\b(ENABLE|DISABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b/.test(head))
    return true;
  return false;
}

// Extract column definitions from a CREATE TABLE statement, skipping
// table-level constraint entries. Returns each as e.g.
//   `workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL`
function extractColumnDefs(stmt: string): string[] {
  const start = stmt.indexOf("(");
  if (start < 0) return [];
  let depth = 0;
  let end = -1;
  for (let i = start; i < stmt.length; i++) {
    if (stmt[i] === "(") depth++;
    else if (stmt[i] === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];
  const body = stmt.slice(start + 1, end);
  const parts: string[] = [];
  let buf = "";
  let pdepth = 0; // ( )
  let bdepth = 0; // [ ]  (ARRAY['a','b'])
  let inString = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      buf += ch;
      if (ch === "'") {
        if (body[i + 1] === "'") {
          buf += body[++i];
        } else inString = false;
      }
      continue;
    }
    // Line comment — copy through end of line so a comma inside doesn't split.
    if (ch === "-" && body[i + 1] === "-") {
      const nl = body.indexOf("\n", i);
      const stop = nl === -1 ? body.length : nl + 1;
      buf += body.slice(i, stop);
      i = stop - 1;
      continue;
    }
    // Block comment.
    if (ch === "/" && body[i + 1] === "*") {
      const close = body.indexOf("*/", i + 2);
      const stop = close === -1 ? body.length : close + 2;
      buf += body.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === "'") {
      inString = true;
      buf += ch;
      continue;
    }
    if (ch === "(") pdepth++;
    else if (ch === ")") pdepth--;
    else if (ch === "[") bdepth++;
    else if (ch === "]") bdepth--;
    if (ch === "," && pdepth === 0 && bdepth === 0) {
      parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  // Drop table-level constraints and strip inline column-level PRIMARY KEY /
  // UNIQUE — both would fail on ADD COLUMN if a PK/unique already exists for
  // the table from the first CREATE TABLE.
  return parts
    .map((p) => p.replace(/^\s*(?:--[^\n]*\n)+/, "").trimStart())
    .filter(
      (p) => !/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE|LIKE)\b/i.test(p),
    )
    .map((p) =>
      p
        .replace(/\s+PRIMARY\s+KEY\b/i, "")
        .replace(/\s+UNIQUE\b/i, "")
        .trim(),
    );
}

function rewriteRls(stmt: string): string {
  let out = stmt
    .replace(/REFERENCES\s+auth\s*\.\s*users\s*\(\s*id\s*\)/gi, "REFERENCES public.users(id)")
    .replace(/REFERENCES\s+auth\s*\.\s*users\b/gi, "REFERENCES public.users")
    // Idempotent: existing DROP POLICY statements get IF EXISTS if they lack it.
    .replace(/\bDROP\s+POLICY\s+(?!IF\s+EXISTS\b)/gi, "DROP POLICY IF EXISTS ");

  // Make CREATE POLICY idempotent — overlapping migrations re-create the same
  // policy and PG has no CREATE OR REPLACE POLICY. Prepend DROP IF EXISTS.
  if (/^CREATE\s+POLICY\b/.test(statementHead(out))) {
    const m = out.match(
      /CREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))\s+ON\s+((?:"?\w+"?\s*\.\s*)?"?\w+"?)/i,
    );
    if (m) {
      const name = m[1] ?? m[2];
      const table = m[3];
      out = `DROP POLICY IF EXISTS "${name}" ON ${table};\n${out}`;
    }
  }
  return out;
}

const RLS_PRELUDE = `-- Generated by db/migration/squash-schema.ts — DO NOT EDIT BY HAND.
--
-- Re-creates the RLS the squash strips from 02_app_schema.sql, for the
-- self-hosted PostgREST + GoTrue stack. Apply AFTER 02_app_schema.sql:
--   00_extensions.sql → 01_auth_js.sql → 02_app_schema.sql → 03_rls_policies.sql
--
-- Provides the roles PostgREST/GoTrue expect and an auth.uid()/auth.role()/
-- auth.jwt() that read the JWT GoTrue mints (PostgREST exposes it as
-- request.jwt.claims), so the policies below work unchanged.

-- Roles ------------------------------------------------------------------------
DO $$ BEGIN CREATE ROLE anon NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator NOINHERIT LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- JWT helpers ------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'role', 'anon')
$$;

-- Policies ---------------------------------------------------------------------
`;

// ──────────────────────────────────────────────────────────────────────────────
// Drive
// ──────────────────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames begin with YYYYMMDDHHMMSS — lexical sort == chronological

  console.log(`[squash] ${files.length} migration files`);

  const banner = [
    "-- Generated by db/migration/squash-schema.ts — DO NOT EDIT BY HAND.",
    "-- Re-run the script after adding new supabase/migrations/*.sql to refresh.",
    "--",
    "-- This file represents the Supabase migration history with Supabase-specific",
    "-- statements stripped (RLS, auth.*, storage.*, pg_net, supabase_realtime,",
    "-- on_auth_user_* triggers) and `auth.users(id)` FKs rewritten to point at",
    "-- the Auth.js `users(id)` table created in 01_auth_js.sql.",
    "--",
    "-- Apply order on a fresh Railway Postgres:",
    "--   1. 00_extensions.sql",
    "--   2. 01_auth_js.sql",
    "--   3. 02_app_schema.sql   (this file)",
    "",
  ].join("\n");

  const parts: string[] = [banner];
  const rlsParts: string[] = [RLS_PRELUDE];
  const seenTables = new Set<string>();
  let kept = 0;
  let skipped = 0;
  let rewritten = 0;
  let rls = 0;
  let droppedDupes = 0;

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const stmts = splitStatements(sql);

    const keptFromFile: string[] = [];
    const rlsFromFile: string[] = [];
    for (const raw of stmts) {
      if (shouldSkip(raw)) {
        skipped++;
        if (isRlsStatement(raw)) {
          // Drop policies that target Supabase-only schemas (e.g. storage.objects)
          // — those tables don't exist in the self-hosted Railway stack.
          const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
          const supabaseOnly = /\b(storage|vault|realtime|net|extensions|cron)\s*\./i.test(
            noComments,
          );
          if (!supabaseOnly) {
            rlsFromFile.push(rewriteRls(raw));
            rls++;
          }
        }
        continue;
      }
      let after = rewrite(raw);

      // Duplicate CREATE TABLE handling — additive merge. CREATE TABLE IF NOT
      // EXISTS on the second occurrence is a no-op (table exists from the
      // first), but follow-ups can reference columns the first didn't have
      // (focus_sessions.ended_at) OR the second can be a less-complete
      // "defensive" redeclaration (task_comments without workspace_id). Drop
      // is wrong because it can wipe columns the first definition had. Emit
      // ALTER TABLE ADD COLUMN IF NOT EXISTS for every column in the second
      // definition so we end up with the union and never lose anything.
      const head = statementHead(after);
      const tableMatch = head.match(
        /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?PUBLIC"?\s*\.\s*)?"?(\w+)"?/,
      );
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        if (seenTables.has(tableName)) {
          const colDefs = extractColumnDefs(after);
          if (colDefs.length > 0) {
            const alters = colDefs
              .map((c) => `ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS ${c};`)
              .join("\n");
            after = `${after};\n-- Additive merge from duplicate CREATE TABLE:\n${alters}`;
            droppedDupes++;
          }
        }
        seenTables.add(tableName);
      }

      if (after !== raw) rewritten++;
      keptFromFile.push(after);
      kept++;
    }

    if (keptFromFile.length > 0) {
      parts.push(`\n-- ──────────────────────────────────────────────────────────────────────`);
      parts.push(`-- ${file}`);
      parts.push(`-- ──────────────────────────────────────────────────────────────────────\n`);
      parts.push(keptFromFile.join("\n\n"));
    }
    if (rlsFromFile.length > 0) {
      rlsParts.push(`\n-- ${file}`);
      rlsParts.push(rlsFromFile.join("\n"));
    }
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, parts.join("\n") + "\n", "utf8");
  rlsParts.push("\nNOTIFY pgrst, 'reload schema';");
  writeFileSync(rlsOutFile, rlsParts.join("\n") + "\n", "utf8");

  console.log(
    `[squash] kept=${kept} skipped=${skipped} rewritten=${rewritten} rls=${rls} dupe-tables=${droppedDupes}`,
  );
  console.log(`[squash] wrote ${outFile}`);
  console.log(`[squash] wrote ${rlsOutFile} (${rls} RLS statements)`);
}

main();
