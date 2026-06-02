# Migrating off Supabase onto Railway Postgres

This is the working plan + runbook for moving the data layer (and eventually
everything else) from Supabase to Railway Postgres + Auth.js + Node services.
The migration is staged so the app keeps running between PRs.

> **Status — superseded.** The phase plan below (Auth.js, converting Deno edge
> functions to Node, replacing `supabase-js`) reflects the *original* direction.
> The project ultimately chose a different shape: **self-host the open-source,
> Supabase-compatible services on Railway** so `@supabase/supabase-js` and the
> Deno edge functions keep working unchanged. See
> [`CUTOVER_RUNBOOK.md`](./CUTOVER_RUNBOOK.md) for the approach that was actually
> built, and [`../edge-runtime/README.md`](../edge-runtime/README.md) /
> [`MIGRATIONS.md`](./MIGRATIONS.md) for how the live system runs today. This
> file is kept for historical context (phases 1a–1c are still accurate).

## Phase plan

| Phase | Scope | Status |
|------:|-------|:------:|
| 1a | DB schema bootstrap for Railway — no app changes | **done** (#4) |
| ~~1b~~ | ~~Data dump/transform/import scripts (Supabase → Railway)~~ | **skipped** — fresh start, see below |
| 1c | Provision Railway PG, apply bootstrap | **runnable** (`db/migration/apply-bootstrap.sh`) |
| 2  | Replace Supabase Auth with Auth.js (NextAuth) |  |
| 3  | Convert Deno edge functions → Node services on Railway |  |
| 4  | Replace `@supabase/supabase-js` client calls with a Postgres client + service modules |  |
| 5  | Move storage (Supabase Storage → S3-compatible: R2 / Backblaze / Railway volume) |  |
| 6  | Replace Realtime subscriptions (custom websocket or third-party — Ably/Pusher) |  |
| 7  | Cutover + decommission Supabase |  |

Each phase is its own draft PR with an explicit test plan. The app stays
runnable against Supabase until phase 7.

### Why phase 1b was skipped

Phase 1b assumed `pg_dump` access to the source Supabase project. That
turned out to be unavailable, so the project owner decided to cut over
to Railway with no data carried across: the bootstrap creates an empty
schema, no rows are replayed, and every existing user is asked to
re-sign-up post-cutover. This is captured in the FAQ below.

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
   ./db/migration/apply-bootstrap.sh
   ```

   The script applies the three SQL files in order. Each individual
   file runs inside a single transaction (`psql -1` + `ON_ERROR_STOP=1`),
   so any failure rolls that file back cleanly. The three files are
   still applied as **three separate transactions**, so a failure on
   `02_app_schema.sql` leaves `00` and `01` committed.

   Re-running after a partial failure won't work in place: the squash
   output in `02_app_schema.sql` contains plenty of bare `CREATE`
   statements (tables, functions, triggers — the source migrations
   didn't all use `IF NOT EXISTS`), and the second run will hit
   "already exists" errors. The cleanest recovery is to drop the
   database — or just the `public` schema — and re-run from a clean
   slate:

   ```bash
   psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
   ./db/migration/apply-bootstrap.sh
   ```

4. **Verify** by counting tables:

   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
   ```

   The number should match (roughly) the unique `CREATE TABLE` count in
   `supabase/migrations/` — at time of writing ~150 unique tables.

## Coming next (Phase 2)

Replace `supabase.auth.*` with Auth.js. Notes:

- The app is a Vite SPA; Auth.js's first-party integrations target
  Next.js / SvelteKit. For us that means standing up a small Node
  service (Express or Fastify with `@auth/express`) that owns the
  callback endpoints and reads/writes the four Auth.js tables in
  `01_auth_js.sql`. The SPA talks to that service.
- Only the credentials (email/password) provider is in use today —
  see `src/contexts/AuthContext.tsx`. Phase 2 ships a fresh signup
  flow on top of `@auth/core`'s Credentials provider.
- Decision pending: keep Auth.js, or switch to a SPA-native auth
  library (Lucia, Clerk, WorkOS). Tracked in the phase-2 PR.

## FAQ

**Why not just `pg_dump` the Supabase project and replay it on Railway?**
Because the Supabase dump includes the `auth`, `storage`, `realtime`,
`extensions`, and `vault` schemas plus a pile of RLS policies and
GRANTs against Supabase-only roles. Replaying it would fail (missing
roles, missing extensions) or quietly diverge from the working set.
The squash script gives us a clean baseline.

**Why is there no data import (no phase 1b)?** The project owner
chose to cut over to Railway with no rows carried across from
Supabase. Every existing user, task, contact, event, contract, note,
etc. is gone after cutover. The driver was missing DB-level access to
the source — without the Supabase postgres password we can't
`pg_dump`. If that access is recovered later, phase 1b can still be
written; nothing in the current plan precludes it.

**Will logins keep working?** **No.** This is a fresh database, so
every user re-signs-up after cutover. Even if data were carried over,
Supabase Auth's bcrypt hashes aren't portable to Auth.js's credentials
provider — credentials users would have needed to reset their
password regardless.

**Will user IDs change?** Yes — they're freshly generated by
`gen_random_uuid()` on signup against the new schema. The runbook's
prior promise of preserving `auth.users.id` only held under phase 1b;
without a data import, all IDs are new.
