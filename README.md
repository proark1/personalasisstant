# OneBrain Assistant

Business personal assistant module for OneBrain, built from
`docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`.

OneBrain owns durable business data, memory, permissions, retrieval, and
audit-of-record. This repository owns only the assistant product surface and
operational state needed to run it: jobs, leases, locks, outbox rows,
idempotency keys, sync cursors, provider subscriptions, encrypted token
storage or secret references, caches, and action execution state.

Browser code calls the assistant API only. It must not call OneBrain service
APIs directly or receive a OneBrain service key.

## Phase 0 Runtime

- `apps/assistant-web`: Next.js / React / TypeScript web shell.
- `services/assistant-runtime`: FastAPI API and Python worker sharing one
  backend package.
- `packages/assistant-api-contract`: generated OpenAPI contract.
- `docker-compose.yml`: local web, API, worker, Postgres, and Redis.

## OneBrain Connection

The assistant now has a concrete `BrainClient` implementation for OneBrain's
service assistant API:

- `GET /api/service/capabilities`
- `POST /api/service/assistant/records`
- `GET /api/service/assistant/records`
- `GET /api/service/assistant/records/{record_id}`
- `POST /api/service/assistant/audit`

Configure a real connection with:

```powershell
ONEBRAIN_API_BASE_URL=https://onebrain-production-0a16.up.railway.app
ONEBRAIN_SERVICE_KEY=<scoped assistant service key>
ONEBRAIN_ACCOUNT_ID=<account id>
ONEBRAIN_SPACE_ID=<space id>
ONEBRAIN_CLIENT_MODE=http
ONEBRAIN_AVAILABLE=true
```

The runtime authenticates to OneBrain with
`Authorization: Bearer <ONEBRAIN_SERVICE_KEY>`. Every service call includes
`account_id`, `space_id`, `app_id=assistant`, and `purpose`; durable assistant
memory, audit, provenance, permissions, retrieval, and privacy-owned data stay
in OneBrain.

For local development without a service key, `ONEBRAIN_CLIENT_MODE=auto` uses an
in-memory brain client when `ENVIRONMENT=local`. Production/staging should use
`ONEBRAIN_CLIENT_MODE=http` and a scoped OneBrain service key.

Concrete local and Railway variables are listed in
`docs/development/environment.md`. Use `http://localhost:8080` for
`ONEBRAIN_API_BASE_URL` when running OneBrain locally.

Phase 0-2 completion status and the remaining service-key gate are documented in
`docs/development/phase-0-2-completion.md`.

## Local Commands

```powershell
npm install
python -m pip install -e services/assistant-runtime[dev]
npm run generate:api
npm run typecheck:web
python -m pytest services/assistant-runtime/tests
```

Run the full Phase 0 verification:

```powershell
npm run verify:phase0
```

The assistant API exposes a narrow smoke-test surface for this connection:

- `POST /v1/brain/records`
- `GET /v1/brain/records`
- `GET /v1/brain/records/{record_id}`
- `POST /v1/brain/audit`

These endpoints use OneBrain assistant contracts and are intended for early
integration checks, not as a general-purpose database proxy.

Run the full stack with Docker Compose:

```powershell
docker compose up --build
```

The web app defaults to `http://localhost:3000` and the API defaults to
`http://localhost:8000`.
