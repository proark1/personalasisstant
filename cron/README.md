# Cron (Railway scheduler)

A small, long-running scheduler that pings the edge functions on a fixed
schedule. It **replaces Supabase `pg_cron` + `net.http_post`**, which are not
available on our self-hosted Railway Postgres (see
[`db/bootstrap/00_extensions.sql`](../db/bootstrap/00_extensions.sql) — `pg_cron`,
`pg_net`, and `supabase_vault` were intentionally dropped at cutover, and
`db/migration/squash-schema.ts` strips every `cron.`/`net.`/`vault.` statement).

Without this service no recurring **briefings/background syncs** fire.

> Telegram **replies** are not handled here — they come in via webhook (see
> [`supabase/functions/telegram-poll/WEBHOOK.md`](../supabase/functions/telegram-poll/WEBHOOK.md)),
> which is instant and needs no scheduler.

## What it runs

Each job mirrors the cron expression of the former `cron.schedule(...)`
migration, evaluated in **UTC**:

| Function | Schedule | Purpose |
|---|---|---|
| `briefing-dispatch-cron` | `*/15 * * * *` | Custom daily briefings (timezone-aware) |
| `telegram-weekly-briefing` | `0 * * * *` | Weekly calendar briefing (Mon 08:00 local) |
| `telegram-family-morning-digest` | `0 * * * *` | Family group morning digest |
| `workspace-recap-cron` | `5 * * * *` | Friday team recap |
| `email-autopilot` | `5 * * * *` | Email handling / auto-replies |
| `plaid-sync-cron` | `15 * * * *` | Financial account sync |
| `meeting-bot-reconciler-cron` | `*/30 * * * *` | Meeting bot reconciliation |
| `trip-prep-cron` | `0 9 * * *` | Trip preparation |
| `calendar-sync-all` | `*/15 * * * *` | Two-way Google/Apple calendar sync |

The hourly/15-min functions are themselves timezone-aware and dedupe per local
day, so pinging them every hour/15 min is correct — they decide when to actually
send.

## ⚠️ If the cron service keeps failing every run

Symptom (Railway → cron → Cron Runs): every execution is red, lasts ~1s, and the
**Current Deployment** image is `curlimages/curl:latest`.

That means the service is **not running this scheduler at all**. It's deploying a
bare `curl` image on Railway's native *Cron Schedule*, which runs a one-shot
container each tick — and `curl` with no valid command exits non-zero
immediately, so every run fails. A single hourly tick also can't reproduce the
`*/15`, `*/30`, and `0 9 * * *` schedules below.

The fix is to point the service at **this repo** so it runs the long-running
scheduler instead of the curl image:

1. Railway → **cron** service → **Settings**.
2. **Source**: connect this **GitHub repo** (remove the `curlimages/curl:latest`
   Docker image source).
3. **Root Directory** = `/` (repo root — the Dockerfile does `COPY cron/...`, so
   the build context must be the repo root, not `cron/`).
4. **Config-as-code → Railway Config File** = `cron/railway.json`. That file pins
   the Dockerfile build, the `/health` check, and an `ON_FAILURE` restart policy.
5. **Settings → Cron Schedule → clear it.** This is a long-running worker, *not* a
   scheduled job — the schedules live inside `scheduler.mjs`. (A `railway.json`
   can't unset an existing dashboard cron schedule, so you must remove it here.)
6. Set the [env vars](#env-vars) below, **enable Private Networking**, and redeploy.

## Deploy to Railway (fresh service)

1. Add a new service in your Railway project (this is the service that should
   replace the failed **cron** one).
2. Source: this repo. **Root Directory / build context = repo root (`/`)**,
   **Config file = `cron/railway.json`** (builds `cron/Dockerfile`, matching how
   `edge-runtime` is set up). Leave the **Cron Schedule blank** — it's a
   long-running worker.
3. Networking → enable **Private Networking** so it can reach the edge-runtime
   at `edge-runtime.railway.internal:9000`.
4. Set the env vars below.
5. Deploy.

## Env vars

| Var | Value | Notes |
|---|---|---|
| `EDGE_FUNCTIONS_URL` | `http://edge-runtime.railway.internal:9000` | Base URL of the edge-runtime service (same value the gateway uses). Override if your edge service has a different internal name. |
| `SUPABASE_SERVICE_ROLE_KEY` | The service-role JWT | **Required.** The dispatcher functions gate on exactly this token. Must match the value set on the `edge-runtime` service. |
| `PORT` | (Railway sets this) | Health server port. Defaults to 8080. |
| `CRON_DISABLED` | `1` to pause all jobs | Health server still runs; useful for temporarily disabling without deleting the service. |

> Why call the internal edge-runtime URL instead of the public gateway?
> It stays on the private network (faster, no egress) and skips the gateway's
> browser-oriented CORS/origin checks. You can point `EDGE_FUNCTIONS_URL` at the
> public gateway (`https://<gateway>/functions/v1`) instead if you prefer.

## Health check

`GET /health` (and `/`) returns `200 {"ok":true,...}`. Point Railway's health
check at `/health` so the service isn't marked unhealthy.

## Verifying it works

Tail the service logs — every fired job logs a line:

```
[cron] health server on :8080
[cron] scheduler started — 8 jobs, base=http://edge-runtime.railway.internal:9000
[cron] briefing-dispatch-cron -> 200 (143ms)
```

The deployment should stay **green/Active** (it's a long-running service, not a
one-shot run). A `401`/`404` line means `SUPABASE_SERVICE_ROLE_KEY` or
`EDGE_FUNCTIONS_URL` is wrong; a `failed:` line (e.g. `fetch failed`) means it
can't reach the edge-runtime — check that **Private Networking** is enabled and
`EDGE_FUNCTIONS_URL` matches the edge service's internal name.

## Local smoke test

```sh
EDGE_FUNCTIONS_URL=http://localhost:9000 SUPABASE_SERVICE_ROLE_KEY=test \
  node cron/scheduler.mjs
```
