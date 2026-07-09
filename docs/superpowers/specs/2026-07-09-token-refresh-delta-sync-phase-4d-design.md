# Token Refresh And Delta Sync Phase 4D Design

Date: 2026-07-09

## Context

Phase 4C added real Google and Microsoft read adapters that can populate
OneBrain provider source records from live read-only provider APIs. It still
uses the access token stored at OAuth callback time and reads a small current
window when sync runs.

Phase 4D makes the provider sync loop durable enough for ongoing use:

- refresh access tokens before live reads
- persist rotated token payloads in the operational secret store
- use provider cursor/delta state when available
- fall back to a safe full read when cursors are missing or expired

OneBrain remains the main database for durable assistant source records and
generated workday artifacts. Assistant Postgres remains operational state only:
provider accounts, token secret refs, sync cursors, subscriptions, jobs, and
retry state.

## Goal

Add refresh-before-read and incremental sync support:

- Google OAuth refresh token flow.
- Microsoft OAuth refresh token flow.
- Google Gmail history-based partial sync when `gmail_history` cursor exists.
- Microsoft Graph message delta for Inbox when mail delta cursor exists.
- Microsoft Graph calendarView delta when calendar delta cursor exists.
- Cursor updates after successful reads.
- Safe fallback to Phase 4C full reads when no cursor exists, delta links are
  missing, or provider delta state is expired.

## Approaches Considered

Recommended: extend the Phase 4C `ProviderReadClient` with an optional cursor
context and add a small token refresh service. This keeps provider HTTP details
inside provider modules and lets sync orchestration stay responsible for
operational cursor writes.

Alternative: implement full provider-specific sync engines. That would scale
later but is too broad for this slice because it would combine token refresh,
delta pagination, deleted item reconciliation, and source-record writes in one
large change.

Alternative: refresh tokens only and defer delta sync. That would make live
reads more reliable, but it would leave provider polling inefficient and cursor
state underused.

## Token Refresh Design

Add a `ProviderTokenRefresher` that:

- reads the stored token payload from the operational secret provider
- detects local/test tokens and leaves them unchanged
- refreshes when the stored token is expired or close to expiry
- posts to the provider token endpoint using `grant_type=refresh_token`
- preserves existing refresh tokens when providers do not return a new one
- stores the rotated token payload through the operational secret provider
- updates the provider account token secret ref and token expiry in the provider
  store

The refresher must never write access tokens, refresh tokens, authorization
headers, token endpoint request bodies, or token endpoint response bodies to
OneBrain.

## Delta Sync Design

Use the existing provider cursor table as operational state.

Google Gmail:

- If a `gmail_history` cursor exists, call
  `users.history.list` with `startHistoryId`.
- Fetch message metadata for message ids returned by history changes.
- If Gmail returns `HTTP 404` for an expired history id, fall back to the Phase
  4C full message read and replace the cursor from the successful response.
- Store the returned `historyId` as the next cursor.

Google Calendar:

- Keep the Phase 4C time-window read for this slice.
- Store the successful sync timestamp/token in `google_calendar_sync_token` so
  stale-state detection remains useful.
- Full Google Calendar incremental sync tokens can be a later slice.

Microsoft mail:

- If a `microsoft_mail_delta_link` cursor exists, call that delta link.
- Otherwise call `/me/mailFolders/inbox/messages/delta`.
- Follow one page in Phase 4D and store `@odata.deltaLink` or `@odata.nextLink`
  as the next cursor.
- If the delta link fails, fall back to the Phase 4C message read.

Microsoft calendar:

- If a `microsoft_calendar_delta_link` cursor exists, call that delta link.
- Otherwise call `/me/calendarView/delta` for the current workday window.
- Store `@odata.deltaLink` or `@odata.nextLink` as the next cursor.
- If the delta link fails, fall back to the Phase 4C calendarView read.

Deleted provider items are not removed from OneBrain in Phase 4D. Deleted or
removed events may be skipped or recorded as operational cursor context only.

## Sync Flow

Provider sync should run:

1. Resolve provider account from Assistant Postgres.
2. Confirm OneBrain is available.
3. Refresh token if needed.
4. Build cursor context from existing provider cursors.
5. Fetch source items through the provider read adapter.
6. Write normalized source records to OneBrain.
7. Upsert provider cursors with the returned cursor values.
8. Record provider health.

If token refresh fails because the refresh token is missing, revoked, or invalid,
sync should mark the provider account degraded and use local fallback records.
It should not advance live provider cursors.

## Error Handling

- Local/test token: skip refresh and use local fallback as before.
- Missing refresh token: degrade provider health and use local fallback.
- Token endpoint failure: degrade provider health and use local fallback.
- Expired Gmail history id: full-read fallback and replace cursor.
- Expired Microsoft delta link: full-read fallback and replace cursor.
- Malformed delta payload: degrade provider health and use local fallback.
- OneBrain unavailable: pause sync as in previous phases.

## Testing

Backend tests should cover:

- Google token refresh request and safe token rotation.
- Microsoft token refresh request and safe token rotation.
- Local/test tokens are not refreshed.
- Google Gmail history cursor is used and updated.
- Gmail history 404 falls back to full read.
- Microsoft mail and calendar delta links are used and updated.
- Delta/read failure degrades health without token leakage.
- Existing Phase 4C full-read and workday tests keep passing.

Final verification target remains:

- `npm run verify:phase0`

## Acceptance Criteria

Phase 4D is complete when:

- Provider sync refreshes expiring Google and Microsoft access tokens.
- Rotated token payloads remain only in the operational secret provider.
- Provider source records in OneBrain never include raw tokens, secret refs, or
  raw provider payloads.
- Gmail and Microsoft delta/cursor state is used when available.
- Cursor state is updated only after successful source writes.
- Delta expiration falls back to safe full reads.
- No external provider write path is introduced.
