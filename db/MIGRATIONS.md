# Migrations on Railway (migrate-on-deploy)

The `migrate` Railway service applies new database migrations automatically on
every deploy, so schema changes no longer need a manual `psql` step.

- **Runner:** [`db/migrate.sh`](./migrate.sh) — applies any
  `supabase/migrations/*.sql` not yet recorded in `public.schema_migrations`, in
  timestamp order, each in its own transaction.
- **Image:** [`db/Dockerfile`](./Dockerfile) — Alpine + `postgresql-client`,
  bundles the migrations and the runner.
- **Service config:** [`db/railway.json`](./railway.json) — one-shot
  (`restartPolicyType: NEVER`): it runs to completion on each deploy and exits.

This is separate from the **bootstrap** ([`db/migration/apply-bootstrap.sh`](./migration/apply-bootstrap.sh)),
which provisions a *fresh* database from `db/bootstrap/`. Bootstrap = day 0;
this runner = every day after.

## One-time setup (create the service in Railway)

1. Railway project → **New → GitHub Repo** → this repo (same source as the
   `edge-functions` / `cron` services).
2. Service **Settings → Config-as-code / Railway config file** → `db/railway.json`
   (mirrors how `cron` points at `cron/railway.json`).
3. **Variables:**
   - `DATABASE_URL` — the Railway Postgres connection string (the **internal**
     URL is fine; add the `migrate` service to the same project so it can reach
     PG over private networking).
   - `MIGRATE_BASELINE` = `20260530150000_event_sync_links.sql` — **set this for
     the first deploy only.** It tells the runner "everything up to and including
     this file is already applied" (true today — the DB was bootstrapped and the
     `event_sync_links` table was applied by hand), so it won't try to replay the
     historical Supabase-only migrations. You can delete this variable after the
     first successful run.
4. Deploy. The logs should show `baseline recorded` (first run) and, on later
   deploys, `applying <file>` for each new migration or `applied 0 new migration(s)`.

> If you deploy without `MIGRATE_BASELINE` on an empty tracking table, the runner
> assumes the DB already matches the whole repo and records every current file as
> applied (with a warning) — safe here, but the explicit baseline is preferred.

## Day-to-day: adding a migration

1. Add `supabase/migrations/<timestamp>_<name>.sql` (same as before).
2. Write it **idempotently** — `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE
   FUNCTION`, `DROP ... IF EXISTS` — so a retry is always safe.
3. Keep it **additive / backward-compatible**: the `migrate`, `edge-functions`,
   and `cron` services deploy in parallel, so a migration may land slightly
   before or after the code that uses it. Don't drop/rename columns the running
   code still reads in the same deploy.
4. Merge → the `migrate` service redeploys and applies it. Confirm in its logs.

If a migration fails, the runner stops with a non-zero exit (Railway marks the
deploy failed) and the failed migration is rolled back and **not** recorded, so
fixing it and redeploying re-runs just that file.

## Checking state

```sql
SELECT version, applied_at FROM public.schema_migrations ORDER BY version DESC LIMIT 10;
```
