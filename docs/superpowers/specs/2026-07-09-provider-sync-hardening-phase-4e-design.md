# Provider Sync Hardening Phase 4E Design

Date: 2026-07-09

## Goal

Phase 4E makes Google and Microsoft read-only sync safer under real provider
failure modes. The assistant should distinguish throttling, transient provider
outages, expired cursors, auth problems, and permanent read failures instead of
collapsing everything into one generic degraded state.

OneBrain remains the main durable assistant database for normalized source
records, workday artifacts, and health/provenance records. Assistant Postgres
continues to own operational state only: tokens, cursors, subscriptions, jobs,
retry timing, and provider sync status.

## Scope

Phase 4E includes:

- Provider error classification for Google and Microsoft read/refresh requests.
- Retry/backoff policy for safe read-only provider calls.
- `Retry-After` handling for Microsoft Graph throttling and provider
  unavailability.
- Truncated exponential backoff with bounded jitter for retryable Google and
  Microsoft failures when providers do not return retry timing.
- Operational provider status fields for last status class, retry-after time,
  stale-since time, and sanitized status detail.
- Provider summary exposure of stale/retry state for web and future Telegram
  health surfaces.
- Tests for throttling, transient failure, auth failure, cursor expiration, and
  token-leak prevention.

Phase 4E does not include:

- Provider write paths.
- Email draft creation, send, label/category writes, calendar event creation, or
  calendar updates.
- A full worker scheduler overhaul.
- UI redesign beyond exposing status fields through existing provider summary
  contracts.
- Long-running multi-page Microsoft delta pagination. Phase 4E may prepare the
  status model for it, but does not need to consume every page.

## Provider Failure Model

Introduce a small provider reliability model shared by token refresh, read
adapters, and sync orchestration.

Failure classes:

- `throttled`: provider returned a quota/rate-limit response, usually 429, or a
  Google usage-limit 403.
- `transient`: network timeout, connection failure, or provider 5xx response.
- `provider_unavailable`: provider asks callers to retry later, usually 503 or
  equivalent.
- `auth`: revoked/invalid token, insufficient permission, or refresh failure
  requiring user action.
- `cursor_expired`: Gmail history or Graph delta state can no longer be used and
  requires a full read fallback.
- `permanent`: malformed response or unsupported provider behavior that should
  not be retried without a code/config change.

Each classified failure carries:

- sanitized user/operator detail
- provider kind
- optional service kind (`mail`, `calendar`, `token_refresh`)
- optional HTTP status
- optional retry-after timestamp
- retryable boolean

Token values, authorization headers, raw provider payloads, and secret refs must
not appear in these details.

## Retry And Backoff

Provider calls remain read-only and idempotent in Phase 4E, so retry is allowed
only around safe operations:

- OAuth refresh token request
- Gmail message list/history/metadata reads
- Google Calendar event reads
- Microsoft message/calendar delta reads
- Microsoft full fallback reads

Retry policy:

- Honor `Retry-After` when present.
- If no `Retry-After` exists, use truncated exponential backoff with jitter.
- Keep the retry count small inside one worker attempt, with defaults such as
  two retries after the first failure.
- Cap per-request sleep so one sync job cannot block the worker for an
  excessive period.
- Preserve existing worker retry/dead-letter behavior for failures that should
  be retried later by the queue instead of busy-waiting in process.

In-memory tests can make retry sleeps injectable or zero-duration. Production
uses real bounded sleeps.

## Operational Status

Extend provider account operational state with sanitized status fields:

- `last_sync_status`: one of `healthy`, `degraded`, `throttled`, `auth_required`,
  `stale`, `paused`
- `last_sync_error_class`: provider failure class, if any
- `retry_after`: timestamp when sync should be retried, if known
- `stale_since`: timestamp marking when live provider data became stale
- `last_status_detail`: sanitized short detail

Existing `status`, `sync_state`, `last_sync_at`, and `last_sync_error` continue
to work for current callers. New fields make the state less ambiguous without
turning Postgres into a second durable knowledge store.

OneBrain receives sanitized provider health records when status changes or a
sync completes/degrades. It does not store retry timers, raw provider responses,
or provider token details.

## Sync Flow

Provider sync keeps the Phase 4D ordering:

1. Check OneBrain availability.
2. Resolve account and operational cursor state.
3. Refresh token if needed.
4. Read provider sources with cursor/delta state.
5. Write normalized OneBrain source records.
6. Update operational cursors after successful source writes.
7. Update operational provider health/status.
8. Record sanitized OneBrain health event.

4E adds:

- skip/short-circuit sync when `retry_after` is still in the future
- classify refresh/read failures
- retry safe provider calls according to policy
- preserve stale data status when fallback records are used
- show whether degradation is from throttling, auth, stale cursor, or transient
  provider failure

## Cursor Expiration

Cursor expiration remains recoverable:

- Gmail history `404` maps to `cursor_expired`, performs the Phase 4D full read
  fallback, and replaces the cursor after source records are written.
- Microsoft delta expiration or invalid delta links map to `cursor_expired`,
  perform a full read fallback, and leave the previous delta cursor untouched
  unless a fresh delta cursor is obtained.

Cursor expiration should not look like auth failure or provider outage.

## API And UI Contract

Provider account summaries expose new fields so web and Telegram can present
clear state:

- whether provider data is healthy, retrying, stale, or needs reconnect
- optional `retry_after`
- optional `stale_since`
- sanitized status detail

The first implementation can keep existing UI unchanged if generated API types
remain compatible, but backend contracts must provide the data for the next UI
slice.

## Testing

Backend tests should cover:

- Google throttling classification from 429 and usage-limit 403.
- Microsoft `Retry-After` parsing on 429/503.
- Retryable transient 5xx succeeds after retry.
- Auth failures do not retry repeatedly and mark account reconnect-needed.
- Gmail history expiration remains full-read fallback, not generic failure.
- Provider summaries expose retry/stale status.
- OneBrain provider source and health records do not leak tokens, secret refs,
  authorization headers, or raw provider payloads.
- Existing Phase 4A-4D tests keep passing.

Final verification target remains:

- `npm run verify:phase0`

## Acceptance Criteria

Phase 4E is complete when:

- Provider sync distinguishes throttling, transient failures, auth failures,
  provider unavailability, cursor expiration, and permanent failures.
- Retryable read/refresh operations use bounded retry/backoff.
- `Retry-After` is respected when providers supply it.
- Provider summaries expose sanitized retry/stale state.
- OneBrain remains the durable assistant database; operational retry/status
  state stays in assistant Postgres.
- No external provider write path is introduced.
- `npm run verify:phase0` passes.

## References

- Microsoft Graph throttling guidance.
- Microsoft Graph delta query guidance.
- Gmail API error handling guidance.
- Gmail API usage-limit guidance.
- Google Calendar quota guidance.
- Google truncated exponential backoff guidance.
