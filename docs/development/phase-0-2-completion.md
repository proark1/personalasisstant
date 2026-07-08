# Phase 0-2 Completion Notes

Date: 2026-07-09

This repo is ready to treat Phases 0, 1, and 2 as complete for local and
service-key-pending development.

## Phase 0: Runtime Foundation

Implemented:

- Monorepo with Next.js web, FastAPI API, Python worker, and generated OpenAPI
  TypeScript client.
- Dockerfiles, Docker Compose, Railway service profiles, and environment-based
  configuration.
- Health checks, Prometheus metrics, request IDs, structured redacted logging,
  provider error counters, and model usage counters.
- Postgres operational schema for actions, transitions, outbox, jobs, locks,
  provider subscriptions, sync cursors, idempotency keys, policy rows, encrypted
  secret references, and operational audit.
- In-memory and Postgres implementations for action state, outbox, jobs,
  Telegram binding state, and encrypted secrets.
- Action state machine, approval dedupe, transactional outbox baseline, worker
  relay, retries, and dead-letter behavior.
- Prompt-injection fixture harness, HTML normalization, hidden text stripping,
  and raw-content firewall.
- Mobile-first Today shell, provider health states, Telegram setup UI, and
  approval-card baseline using the brand-aligned light design direction.

## Phase 1: OneBrain Contracts

Implemented:

- Assistant runtime `BrainClient` interface with memory, disabled, and HTTP
  implementations.
- HTTP client routes aligned to OneBrain:
  - `GET /api/service/capabilities`
  - `POST /api/service/assistant/records`
  - `GET /api/service/assistant/records`
  - `GET /api/service/assistant/records/{record_id}`
  - `POST /api/service/assistant/audit`
- Local contract validation for assistant purposes, record types, intents, audit
  action namespaces, and raw-secret rejection before records reach memory or
  HTTP mode.
- Memory-mode OneBrain records include the same `assistant_contract` wrapper
  used by OneBrain.
- Smoke coverage for the required assistant record families: briefs,
  follow-ups, action proposals/audit, voice transcripts, Telegram bindings,
  notification events/preferences, messages, provider accounts, scope grants,
  secret references, sync subscriptions/cursors, policy decisions, provider
  health, settings, focus planning, model usage, security decisions, and
  feedback.

Pending external credential:

- `ONEBRAIN_SERVICE_KEY` is intentionally not filled yet. Until it is added,
  local development should use `ONEBRAIN_CLIENT_MODE=auto` or `memory`.
  Production/staging should use `ONEBRAIN_CLIENT_MODE=http`.

## Phase 2: Telegram Channel

Implemented:

- BotFather token setup panel in the web app.
- Bot token storage through `SecretProvider`; raw token is never returned.
- Private Telegram chat binding with `/start <code>`.
- Webhook secret validation using constant-time comparison.
- Webhook replay dedupe by Telegram update ID.
- Pause, resume, and status commands.
- Inbound text recorded as untrusted content and never converted into an action.
- Verified-binding test messages are queued through the outbox and delivered by
  the worker, not sent inline from HTTP requests.
- Telegram delivery failures are retried/dead-lettered and error details are
  redacted.
- Telegram binding, inbound message, test-message, command, and delivery events
  are written through `BrainClient` when OneBrain is available. In local memory
  mode this proves the contract; in HTTP mode it becomes real OneBrain
  provenance once `ONEBRAIN_SERVICE_KEY` is set.

## Next Gate

Before Phase 3 starts, add the real `ONEBRAIN_SERVICE_KEY` locally and in
Railway, set `ONEBRAIN_CLIENT_MODE=http`, and run the OneBrain smoke path
against production OneBrain.
