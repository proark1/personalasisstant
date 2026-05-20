# Migrating off Supabase onto Railway Postgres

This is the working plan + runbook for moving the data layer (and eventually
everything else) from Supabase to Railway Postgres + Auth.js + Node services.
The migration is staged so the app keeps running between PRs.

## Phase plan

| Phase | Scope | Status |
|------:|-------|:------:|
| 1a | DB schema bootstrap for Railway (this PR) — no app changes | **in progress** |
| 1b | Data dump/transform/import scripts (Supabase → Railway) |  |
| 1c | Provision Railway PG, apply bootstrap, replay data, verify counts |  |
| 2  | Replace Supabase Auth with Auth.js (NextAuth) |  |
| 3  | Convert Deno edge functions → Node services on Railway |  |
| 4  | Replace `@supabase/supabase-js` client calls with a Postgres client + service modules |  |
| 5  | Move storage (Supabase Storage → S3-compatible: R2 / Backblaze / Railway volume) |  |
| 6  | Replace Realtime subscriptions (custom websocket or third-party — Ably/Pusher) |  |
| 7  | Cutover + decommission Supabase |  |

Each phase is its own draft PR with an explicit test plan. The app stays
runnable against Supabase until phase 7.

## What lives in `db/bootstrap/`

Three SQL files. Apply them in order to a freshly created Railway Postgres:

1. `00_extensions.sql` — pgcrypto, uuid-ossp, citext, pgvector.
2. `01_auth_js.sql` — `users`, `accounts`, `sessions`, `verification_tokens`
   (the [Auth.js Postgres adapter](https://authjs.dev/getting-started/adapters/pg) schema).
3. `02_app_schema.sql` — every `CREATE TABLE` / `CREATE INDEX` / `CREATE FUNCTION` /
   etc. that lives in `supabase/migrations/` today, but with the
   Supabase-specific parts removed and `auth.users` FKs rewritten to point
   at `public.users`.

`02_app_schema.sql` is **generated** by `db/migration/squash-schema.ts`
and is committed so applying the bootstrap doesn't require running the
script. Re-run the script (`bun db/migration/squash-schema.ts`) whenever
new files land in `supabase/migrations/`.

### What the squash strips (Supabase-only)

- `CREATE POLICY` / `ALTER POLICY` / `DROP POLICY` — RLS is replaced by
  application-layer filters in service modules (see Phase 4).
- `ALTER TABLE ... (ENABLE|DISABLE|FORCE) ROW LEVEL SECURITY`.
- Anything referencing the `storage`, `vault`, `realtime`, `net`,
  `extensions`, or `cron` schemas.
- `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (Realtime replaced in Phase 6).
- `CREATE EXTENSION pg_net` / `supabase_vault`.
- Triggers that fire on `auth.users` — equivalent behaviour (e.g. "insert a
  `profiles` row on signup") moves into the Auth.js signup callback in Phase 2.
- `GRANT` / `REVOKE` on Supabase-managed roles (`anon`, `authenticated`,
  `service_role`, etc.).

### What the squash rewrites

- `REFERENCES auth.users(id)` → `REFERENCES public.users(id)`. The data
  migration (Phase 1b) will copy Supabase `auth.users` rows into
  `public.users` while preserving the `id` UUID, so every app-table FK
  stays valid after cutover.
- `auth.uid()` and `auth.role()` calls that survived outside policy
  bodies (e.g. inside views, functions, CHECK constraints) are replaced
  with `NULL` / `'authenticated'` and tagged with a
  `TODO(auth-migration):` comment. Audit these by `grep`-ing for
  `TODO(auth-migration)` in `02_app_schema.sql` before Phase 4 — they
  almost always become per-request parameters passed in from the service
  module.

## Provisioning Railway Postgres (Phase 1c)

These steps are for when you're ready to spin up the database — they're
NOT executed by this PR.

1. **Create the Postgres plugin** on Railway:
   - Railway dashboard → your project → New → Database → Add PostgreSQL.
   - Railway exposes `DATABASE_URL`, `PGUSER`, `PGPASSWORD`, etc. as service
     variables. The internal URL is reachable from other Railway services;
     the public URL is for one-off psql sessions and the migration scripts.

2. **Enable extensions.** Railway's managed Postgres ships with pgvector
   and the common contrib modules available — they just need
   `CREATE EXTENSION`. Either run `00_extensions.sql` (below) or open the
   Railway PG → "Data" tab → "Query" and paste the file's contents.

3. **Apply the bootstrap** from your laptop with the *public* connection
   string:

   ```bash
   export DATABASE_URL="postgres://...railway.app:.../railway"
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bootstrap/00_extensions.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bootstrap/01_auth_js.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bootstrap/02_app_schema.sql
   ```

   Each file is idempotent (every `CREATE` uses `IF NOT EXISTS` where the
   source migrations did). If any file errors out, fix the underlying
   migration / squash rule and re-run; nothing is partially applied because
   of `ON_ERROR_STOP=1`.

4. **Verify** by counting tables:

   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
   ```

   The number should match (roughly) the unique `CREATE TABLE` count in
   `supabase/migrations/` — at time of writing ~150 unique tables.

## Coming next (Phase 1b)

The next PR in this chain will add:

- `db/migration/dump-supabase.sh` — `pg_dump --schema=public --data-only --no-owner`
  against the current Supabase project (read from `SUPABASE_DB_URL`).
- `db/migration/transform-dump.ts` — rewrites the dump:
  - Inserts `auth.users` rows into `public.users` (preserving `id`).
  - Maps `auth.identities` rows into `public.accounts` for OAuth users.
  - Skips `auth.users.encrypted_password` (Supabase bcrypt hashes are not
    portable to Auth.js — credentials users will go through a password
    reset on first post-cutover login).
- `db/migration/apply-railway.sh` — feeds the transformed dump into Railway.
- A verification script that compares per-table row counts between
  Supabase and Railway and prints a diff.

## FAQ

**Why not just `pg_dump` the Supabase project and replay it on Railway?**
Because the Supabase dump includes the `auth`, `storage`, `realtime`,
`extensions`, and `vault` schemas plus a pile of RLS policies and
GRANTs against Supabase-only roles. Replaying it would fail (missing
roles, missing extensions) or quietly diverge from the working set.
The squash script gives us a clean baseline; the data migration
(Phase 1b) handles the rows separately.

**Will logins keep working?** OAuth (Google, GitHub, etc.) survives
the cutover because we preserve `provider` + `providerAccountId` in
the Auth.js `accounts` table. Password logins do **not** — Supabase
Auth uses a bcrypt configuration we can't replay in Auth.js's
credentials provider. Phase 2 ships with a one-time "reset your
password" email to all credentials users.

**Will user IDs change?** No. We deliberately preserve the
`auth.users.id` UUID as `public.users.id` so every FK in the app
schema (e.g. `tasks.user_id`) remains valid without remapping.
