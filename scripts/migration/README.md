# Migration scripts — Supabase → Railway + Vercel + Deno Deploy

These scripts back up the existing Supabase project so the rest of the
migration can proceed against a known-good snapshot. Run **Phase 0
before touching anything else** — every later phase assumes you can
roll back to the dump these scripts produce.

## Phase 0 — Back up Supabase

### Prerequisites

- `pg_dump` 16+ on your machine (`brew install postgresql@16` /
  `apt install postgresql-client-16`). Older `pg_dump` will refuse to
  dump from the Supabase server.
- The Supabase Postgres connection string. Get it from
  **Supabase Studio → Project Settings → Database → Connection string →
  URI**. Use the **Session pooler** URL on port 5432 — the transaction
  pooler on 6543 does not support `pg_dump`.

### Run it

```bash
export SUPABASE_DB_URL='postgresql://postgres:[PW]@db.femilfmcmqmdbncmgcxh.supabase.co:5432/postgres'
./scripts/migration/backup-supabase.sh
```

The script writes to `./backups/<timestamp>/` by default. Pass a path
to override:

```bash
./scripts/migration/backup-supabase.sh ~/darai-backups/2026-05-17
```

You get five files plus a manifest:

| File              | What it is                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `public.dump`     | `pg_dump -Fc` of the `public` schema — the primary restore artifact.       |
| `public.sql.gz`   | Same data as plain SQL, gzipped. Grep-able, diff-able.                     |
| `auth_users.sql`  | `auth.users` + `auth.identities` rows + DDL. Input for Phase 2 (Lucia).    |
| `storage_meta.sql`| `storage` schema metadata. The actual file bytes are NOT included.         |
| `row_counts.txt`  | Per-table row counts. Used by `verify-backup.sh` and the Phase 1 restore.  |
| `manifest.txt`    | Project ref, pg_dump version, file sizes, total row count.                 |

> **Storage file bytes are not in this dump.** Supabase stores them in
> object storage, not Postgres. Download bucket contents separately via
> Studio (Storage → bucket → download all) or the Storage API before
> wiping the Supabase project.

### Verify it

Restoring the dump into a throwaway local Postgres and diffing row
counts is the only way to know the backup is intact. Don't skip this.

```bash
# Local Postgres on a Unix socket, default user:
./scripts/migration/verify-backup.sh ./backups/<timestamp>/

# Remote staging instance:
VERIFY_DB_URL='postgresql://user:pw@host:5432/postgres' \
  ./scripts/migration/verify-backup.sh ./backups/<timestamp>/
```

The script creates a fresh database, runs `pg_restore --exit-on-error`,
compares row counts against `row_counts.txt`, and drops the database on
exit. If it prints `✓ verified`, the dump is a valid Phase 1 input.

### What's NOT in the backup (and how to handle each)

- **Edge function source** — already in `supabase/functions/`, version
  controlled. Nothing to back up.
- **Edge function secrets / env vars** — list them from Supabase Studio
  → Edge Functions → Settings. Copy to a password manager before
  cutover; we'll re-set them on Deno Deploy in Phase 4.
- **Storage objects** — download separately, see above.
- **Realtime channel state** — ephemeral, not backed up.
- **Database webhooks / cron schedules** — captured in the public dump
  if defined via `pg_cron`; if you've configured webhooks through the
  dashboard, screenshot the config.
- **Auth provider OAuth client IDs/secrets** — recorded under
  Authentication → Providers. Copy these out manually; we re-register
  them in Phase 2.

## Phase 1+ — see the migration plan in chat history

These scripts only cover Phase 0. Subsequent phases will live next to
them as they're written.
