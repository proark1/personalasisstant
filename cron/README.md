# Cron (Railway scheduler)

A small, long-running scheduler that pings the edge functions on a fixed
schedule. It **replaces Supabase `pg_cron` + `net.http_post`**, which are not
available on our self-hosted Railway Postgres (see
[`db/bootstrap/00_extensions.sql`](../db/bootstrap/00_extensions.sql) — `pg_cron`,
`pg_net`, and `supabase_vault` were intentionally dropped at cutover, and
`db/migration/squash-schema.ts` strips every `cron.`/`net.`/`vault.` statement).

Without this service nothing recurring runs: the Telegram bot is never polled
(so it never replies), and no daily/weekly briefings or background syncs fire.

## What it runs

Each job mirrors the cron expression of the former `cron.schedule(...)`
migration, evaluated in **UTC**:

| Function | Schedule | Purpose |
|---|---|---|
| `telegram-poll` | `* * * * *` (every minute, non-overlapping) | Polls Telegram & replies — **this is what makes the bot answer** |
| `briefing-dispatch-cron` | `*/15 * * * *` | Custom daily briefings (timezone-aware) |
| `telegram-weekly-briefing` | `0 * * * *` | Weekly calendar briefing (Mon 08:00 local) |
| `telegram-family-morning-digest` | `0 * * * *` | Family group morning digest |
| `workspace-recap-cron` | `5 * * * *` | Friday team recap |
| `email-autopilot` | `5 * * * *` | Email handling / auto-replies |
| `plaid-sync-cron` | `15 * * * *` | Financial account sync |
| `meeting-bot-reconciler-cron` | `*/30 * * * *` | Meeting bot reconciliation |
| `trip-prep-cron` | `0 9 * * *` | Trip preparation |

The hourly/15-min functions are themselves timezone-aware and dedupe per local
day, so pinging them every hour/15 min is correct — they decide when to actually
send.

## Deploy to Railway

1. Add a new service in your Railway project (this is the service that should
   replace the failed **cron** one).
2. Source: this repo. **Root Directory / build context = repo root (`/`)**,
   **Dockerfile path = `cron/Dockerfile`** (matches how `edge-runtime` is set up).
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
[cron] scheduler started — 9 jobs, base=http://edge-runtime.railway.internal:9000
[cron] telegram-poll -> 200 (812ms)
[cron] briefing-dispatch-cron -> 200 (143ms)
```

Then message your Telegram bot — within a minute you should get a reply. A
`401`/`404` line means `SUPABASE_SERVICE_ROLE_KEY` or `EDGE_FUNCTIONS_URL` is
wrong.

## Local smoke test

```sh
EDGE_FUNCTIONS_URL=http://localhost:9000 SUPABASE_SERVICE_ROLE_KEY=test \
  node cron/scheduler.mjs
```
