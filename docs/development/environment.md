# Environment Variables And Links

This file lists the concrete local and Railway values for the current assistant
foundation. Real secrets stay out of git and must be stored in `.env` locally or
Railway variables in production.

## Local URLs

| Service | URL |
|---|---|
| Assistant web | `http://localhost:3000` |
| Assistant API | `http://localhost:8000` |
| Assistant API readiness | `http://localhost:8000/health/ready` |
| Assistant API docs | `http://localhost:8000/docs` |
| OneBrain production API | `https://onebrain-production-0a16.up.railway.app` |
| OneBrain production health | `https://onebrain-production-0a16.up.railway.app/health` |

## Railway URLs

| Service | URL |
|---|---|
| Assistant web | `https://personalasisstant-production.up.railway.app` |
| Assistant API | `https://assistant-api-production-5210.up.railway.app` |
| Assistant API readiness | `https://assistant-api-production-5210.up.railway.app/health/ready` |
| OneBrain API | `https://onebrain-production-0a16.up.railway.app` |

## Local `.env`

The local `.env` file has been filled with:

- Local web/API URLs.
- Current production OneBrain API URL.
- Docker Compose Postgres and Redis URLs.
- Generated local-only `SECRET_MASTER_KEY`.
- Generated local-only `TELEGRAM_WEBHOOK_SECRET`.
- Empty placeholders for external secrets.

Keep `ONEBRAIN_CLIENT_MODE=auto` while `ONEBRAIN_SERVICE_KEY` is empty. In local
mode this uses the in-memory BrainClient. After creating a scoped assistant
service key in OneBrain, set:

```text
ONEBRAIN_CLIENT_MODE=http
ONEBRAIN_SERVICE_KEY=<scoped assistant service key>
ONEBRAIN_ACCOUNT_ID=<account id>
ONEBRAIN_SPACE_ID=<space id>
```

Leave `OPERATIONAL_STORE` unset in local `.env` unless you explicitly want the
API to require Postgres outside Docker. Docker Compose and Railway set or default
the operational store to Postgres themselves.

## Railway Variables

Set these on `assistant-api`:

```text
ENVIRONMENT=production
LOG_LEVEL=INFO
SERVICE_NAME=assistant-api
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
OPERATIONAL_STORE=postgres
ONEBRAIN_API_BASE_URL=https://onebrain-production-0a16.up.railway.app
ONEBRAIN_AVAILABLE=true
ONEBRAIN_CLIENT_MODE=http
ONEBRAIN_SERVICE_KEY=<scoped assistant service key from OneBrain>
ONEBRAIN_ACCOUNT_ID=<account id>
ONEBRAIN_SPACE_ID=<space id>
ONEBRAIN_TIMEOUT_SECONDS=10
SECRET_MASTER_KEY=<strong random secret>
TELEGRAM_WEBHOOK_SECRET=<strong random webhook secret>
CORS_ORIGINS=https://personalasisstant-production.up.railway.app
GEMINI_API_KEY=<Gemini API key when voice/model calls are enabled>
```

Set these on `assistant-worker`:

```text
ENVIRONMENT=production
LOG_LEVEL=INFO
SERVICE_NAME=assistant-worker
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
OPERATIONAL_STORE=postgres
ONEBRAIN_API_BASE_URL=https://onebrain-production-0a16.up.railway.app
ONEBRAIN_AVAILABLE=true
ONEBRAIN_CLIENT_MODE=http
ONEBRAIN_SERVICE_KEY=<scoped assistant service key from OneBrain>
ONEBRAIN_ACCOUNT_ID=<account id>
ONEBRAIN_SPACE_ID=<space id>
ONEBRAIN_TIMEOUT_SECONDS=10
SECRET_MASTER_KEY=<same secret as assistant-api>
TELEGRAM_WEBHOOK_SECRET=<same webhook secret as assistant-api>
WORKER_ID=assistant-worker-railway
WORKER_POLL_SECONDS=5
GEMINI_API_KEY=<Gemini API key when voice/model calls are enabled>
```

Set this on `assistant-web`:

```text
NEXT_PUBLIC_ASSISTANT_API_URL=https://assistant-api-production-5210.up.railway.app
```

Do not set OneBrain service variables on `assistant-web`; browser code only talks
to the assistant API.

## Secrets Not Filled Here

These must be created outside the repo:

- `ONEBRAIN_SERVICE_KEY`: mint in OneBrain with assistant app, read/write scopes,
  allowed assistant purposes, and the correct account/space.
- `ONEBRAIN_ACCOUNT_ID` and `ONEBRAIN_SPACE_ID`: use the canonical OneBrain
  scope for service health checks and worker-originated calls.
- `GEMINI_API_KEY`: create in Google AI Studio or the selected Gemini provider
  account when model/voice features are enabled.
- Telegram bot token: entered by the user in the web onboarding flow and stored
  through `SecretProvider`; it is not a global environment variable.
