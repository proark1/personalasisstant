# OneBrain Assistant

Business personal assistant module for OneBrain, built from
`docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`.

OneBrain owns durable business data, memory, permissions, retrieval, and
audit-of-record. This repository owns only the assistant product surface and
operational state needed to run it: jobs, leases, locks, outbox rows,
idempotency keys, sync cursors, provider subscriptions, encrypted token
storage or secret references, caches, and action execution state.

## Phase 0 Runtime

- `apps/assistant-web`: Next.js / React / TypeScript web shell.
- `services/assistant-runtime`: FastAPI API and Python worker sharing one
  backend package.
- `packages/assistant-api-contract`: generated OpenAPI contract.
- `docker-compose.yml`: local web, API, worker, Postgres, and Redis.

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

Run the full stack with Docker Compose:

```powershell
docker compose up --build
```

The web app defaults to `http://localhost:3000` and the API defaults to
`http://localhost:8000`.
