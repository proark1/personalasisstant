# Provider Sync Hardening Phase 4E Implementation Plan

Date: 2026-07-09

Spec: `docs/superpowers/specs/2026-07-09-provider-sync-hardening-phase-4e-design.md`

## Objective

Harden read-only Google and Microsoft provider sync by classifying provider
failures, applying bounded retry/backoff, and exposing sanitized retry/stale
status while keeping OneBrain as the main durable assistant database.

## Step 1: Operational Status Fields

- Extend provider account schemas with operational status fields:
  - `last_sync_status`
  - `last_sync_error_class`
  - `retry_after`
  - `stale_since`
  - `last_status_detail`
- Add in-memory and Postgres store methods for updating provider sync status.
- Add a migration for the new Postgres columns.
- Extend provider account summaries with the new fields.

## Step 2: Reliability Model

- Add provider reliability types:
  - failure classes
  - sync status classes
  - sanitized provider error object
  - retry policy configuration
- Add `Retry-After` parsing for seconds and HTTP-date values.
- Add deterministic/injectable bounded backoff calculation for tests.

## Step 3: Request Retry Wrapper

- Add an async helper for safe provider requests.
- Retry only read-only/idempotent requests and OAuth refresh.
- Retry Google 429, Google usage-limit 403 reasons, and Google 5xx.
- Retry Microsoft 429/503/504 and transient HTTP/network failures.
- Respect `Retry-After` before exponential backoff when provided.
- Preserve the final classified failure when retries are exhausted.

## Step 4: Token Refresh Integration

- Use the retry wrapper around Google/Microsoft token refresh calls.
- Map auth failures to `auth` rather than generic provider failure.
- Keep token payloads, headers, request bodies, and secret refs out of errors.

## Step 5: Read Adapter Integration

- Use the retry wrapper for Gmail, Google Calendar, Microsoft mail, and
  Microsoft calendar reads.
- Preserve existing Gmail cursor-expired fallback behavior.
- Preserve Microsoft delta fallback behavior.
- Return classified degradation reasons through `ProviderFetchResult`.

## Step 6: Sync Status Integration

- Short-circuit provider sync when operational `retry_after` is still in the
  future.
- On success, clear retry/stale status and mark healthy.
- On throttled/transient/provider-unavailable failures, set retry/stale status
  without leaking provider payloads.
- On auth failure, set reconnect-needed status.
- Record sanitized OneBrain health events.

## Step 7: Tests

- Add reliability unit tests for retry classification and retry-after parsing.
- Add provider read tests for Google throttling, Microsoft retry-after, and
  transient retry success.
- Add token refresh tests for auth and retryable failures.
- Add sync tests for retry-after short-circuit and provider summary status.
- Keep all existing provider/workday tests passing.

## Step 8: Verification

- Run focused reliability/provider tests.
- Run backend lint.
- Run `npm run verify:phase0`.

## Completion Criteria

- Retryable read/refresh failures use bounded retry/backoff.
- `Retry-After` is honored when supplied.
- Provider summaries expose sanitized retry/stale status.
- OneBrain source/health records do not leak tokens, secret refs, headers, or
  raw provider payloads.
- No external provider write path is introduced.
- `npm run verify:phase0` passes.
