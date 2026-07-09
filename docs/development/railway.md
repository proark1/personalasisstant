# Railway Phase 0 Deployment

Railway is a deployment target, not a product dependency. The same Dockerfiles
used by Railway can run through Docker Compose, on a VM, or in Kubernetes later.

Services:

- `assistant-web`: Next.js app from `apps/assistant-web/Dockerfile`.
- `assistant-api`: FastAPI entrypoint from `services/assistant-runtime/Dockerfile`.
- `assistant-worker`: Python worker entrypoint from the same backend image.
- `postgres`: Railway Postgres plugin or an external Postgres URL.
- `redis`: Railway Redis plugin or an external Redis URL.

Required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `OPERATIONAL_STORE`
- `ONEBRAIN_API_BASE_URL`
- `ONEBRAIN_AVAILABLE`
- `ONEBRAIN_CLIENT_MODE`
- `ONEBRAIN_SERVICE_KEY`
- `ONEBRAIN_ACCOUNT_ID`
- `ONEBRAIN_SPACE_ID`
- `ONEBRAIN_TIMEOUT_SECONDS`
- `SECRET_MASTER_KEY`
- `TELEGRAM_WEBHOOK_SECRET`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_ASSISTANT_API_URL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_WEBHOOK_VERIFICATION_TOKEN`
- `MICROSOFT_OAUTH_CLIENT_ID`
- `MICROSOFT_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_REDIRECT_URI`
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_WEBHOOK_CLIENT_STATE`

Current known values:

- `ONEBRAIN_API_BASE_URL`: `https://onebrain-production-0a16.up.railway.app`
- `NEXT_PUBLIC_ASSISTANT_API_URL`: `https://assistant-api-production-5210.up.railway.app`
- `CORS_ORIGINS`: `https://personalasisstant-production.up.railway.app`

OneBrain service variables belong on `assistant-api` and `assistant-worker`
only. The browser-facing web service receives only `NEXT_PUBLIC_ASSISTANT_API_URL`.

Secrets still need to be set in Railway, not committed:

- `ONEBRAIN_SERVICE_KEY`: scoped assistant service key minted in OneBrain.
- `ONEBRAIN_ACCOUNT_ID`: canonical OneBrain account id for this assistant service.
- `ONEBRAIN_SPACE_ID`: canonical OneBrain space id for this assistant service.
- `SECRET_MASTER_KEY`: strong random value shared by API and worker.
- `TELEGRAM_WEBHOOK_SECRET`: strong random value shared by API and Telegram webhook config.
- `GEMINI_API_KEY`: only needed once model/voice calls are enabled.
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`: Google Cloud OAuth
  app credentials for Gmail/Calendar read-only sync.
- `GOOGLE_OAUTH_REDIRECT_URI`:
  `https://assistant-api-production-5210.up.railway.app/v1/providers/oauth/google/callback`
- `GOOGLE_PUBSUB_TOPIC`: optional until Gmail push watch is enabled.
- `GOOGLE_WEBHOOK_VERIFICATION_TOKEN`: strong random value for Google webhook
  channel validation.
- `MICROSOFT_OAUTH_CLIENT_ID` and `MICROSOFT_OAUTH_CLIENT_SECRET`: Entra app
  registration credentials for Microsoft Graph.
- `MICROSOFT_OAUTH_REDIRECT_URI`:
  `https://assistant-api-production-5210.up.railway.app/v1/providers/oauth/microsoft/callback`
- `MICROSOFT_TENANT_ID`: `common`, `organizations`, or a tenant id.
- `MICROSOFT_WEBHOOK_CLIENT_STATE`: strong random value for Graph change
  notification client-state validation.

## Config Files

`railway.json` at the repository root is the default deploy profile for
`assistant-web`, because Railway auto-detects that filename from the service
root.

The files in `railway/` are service templates:

- `railway/assistant-web.railway.json`
- `railway/assistant-api.railway.json`
- `railway/assistant-worker.railway.json`

For API and worker services, either configure the same Dockerfile path and start
command in Railway's service settings, or copy the matching template to
`railway.json` before deploying that service.

The repeatable CLI-safe deploy helper does the copy-and-restore flow for you:

```powershell
.\scripts\deploy-railway-service.ps1 -Service web
.\scripts\deploy-railway-service.ps1 -Service api
.\scripts\deploy-railway-service.ps1 -Service worker
```

Use `-DryRun` to verify the Railway service name, template, and command without
changing files or deploying.

Start commands:

- Web: `npm --workspace apps/assistant-web run start`
- API: `assistant-api`
- Worker: `assistant-worker`

Both the web and API processes honor Railway's injected `PORT` environment
variable.

Readiness:

- Web: `/api/health`
- API: `/health/ready`
- Worker: `python -m assistant_runtime.worker.healthcheck`

## Production Railway Topology

Current production project: `imaginative-nourishment`.

Services:

- `personalasisstant`: GitHub-backed web service from `proark1/personalasisstant`
  on `main`, deployed from the root `railway.json`.
- `assistant-api`: FastAPI service deployed from
  `services/assistant-runtime/Dockerfile` with `assistant-api`.
- `assistant-worker`: worker service deployed from
  `services/assistant-runtime/Dockerfile` with `assistant-worker`.
- `Postgres`: operational Postgres only, for jobs, leases, locks, outbox rows,
  actions, idempotency keys, provider subscriptions, sync cursors, policy rows,
  and secret references/encrypted operational tokens.
- `Redis`: queue, scheduler wakeups, retries, locks, and dead-letter support.

Public endpoints:

- Web: `https://personalasisstant-production.up.railway.app`
- API: `https://assistant-api-production-5210.up.railway.app`

OneBrain remains the durable business-data system of record. The assistant
Postgres database must not store business memory, durable business records, or
OneBrain audit-of-record data.

## GitHub Deploy Caveat

Railway supports per-service config paths in the dashboard, but the CLI in this
Windows environment could not persist service config changes through
`railway environment edit`, and `railway config pull/plan` was blocked by the
Railway TypeScript IaC runner resolving imports with an invalid Windows
`?namespace` path.

Until the API and worker services have their Railway config paths set in the
dashboard or through a working IaC runner, leave those two services without a
GitHub source and deploy them with the helper above. Connecting them directly to
the GitHub repo without setting their service-specific config paths can cause
Railway to use the root web `railway.json` for backend deployments.
