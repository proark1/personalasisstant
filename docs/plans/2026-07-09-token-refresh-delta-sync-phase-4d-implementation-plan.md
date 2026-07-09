# Token Refresh And Delta Sync Phase 4D Implementation Plan

Date: 2026-07-09

Spec: `docs/superpowers/specs/2026-07-09-token-refresh-delta-sync-phase-4d-design.md`

## Objective

Make provider sync reliable for ongoing use by refreshing short-lived access
tokens and using provider cursor/delta state before falling back to Phase 4C
full reads.

OneBrain remains the durable database for assistant provider source records and
generated workday artifacts. Assistant Postgres remains operational state only.

## Step 1: Token Refresh Service

- Add provider token refresh support for Google and Microsoft.
- Detect local/test tokens and skip refresh.
- Refresh expiring live tokens with `grant_type=refresh_token`.
- Preserve the prior refresh token when a provider response omits a new one.
- Store rotated token payloads in the operational secret provider.
- Update provider account token secret ref and expiry in the provider store.
- Keep token values out of OneBrain metadata, logs, and provider health detail.

## Step 2: Cursor Context Models

- Add internal read-adapter models for cursor input and cursor output.
- Include cursor kinds already used by Phase 3/4:
  - `gmail_history`
  - `google_calendar_sync_token`
  - `microsoft_mail_delta_link`
  - `microsoft_calendar_delta_link`
- Keep cursor state in the provider store only.

## Step 3: Google Incremental Reads

- Use Gmail `users.history.list` when a `gmail_history` cursor exists.
- Fetch metadata for message ids returned by history changes.
- Update the `gmail_history` cursor from the returned `historyId`.
- On Gmail history `404`, fall back to Phase 4C full read and replace the
  cursor from the successful full read response.
- Keep Google Calendar on the Phase 4C day-window read for this slice while
  preserving/updating the operational cursor timestamp.

## Step 4: Microsoft Delta Reads

- Use `microsoft_mail_delta_link` when available; otherwise start
  `/me/mailFolders/inbox/messages/delta`.
- Use `microsoft_calendar_delta_link` when available; otherwise start
  `/me/calendarView/delta` for the current workday window.
- Store `@odata.deltaLink` when present, otherwise `@odata.nextLink`.
- Fall back to Phase 4C full reads on delta failures.

## Step 5: Sync Wiring

- Run token refresh before provider reads.
- Pass cursor context into the read adapter.
- Write OneBrain source records first.
- Upsert cursor values only after source records are written successfully.
- Mark provider health degraded on refresh/delta failures without raising raw
  provider details.

## Step 6: Tests

- Add token refresh tests for Google and Microsoft.
- Add local-token no-refresh tests.
- Add Gmail history cursor and 404 fallback tests.
- Add Microsoft mail/calendar delta cursor tests.
- Add sync tests proving rotated token strings and secret refs never appear in
  OneBrain source records.
- Keep existing provider/workday tests passing.

## Step 7: Verification

- Run focused provider tests.
- Run backend lint.
- Run `npm run verify:phase0`.

## Completion Criteria

- Refresh-before-read works for Google and Microsoft.
- Delta/cursor reads are used when cursor state exists.
- Cursor state is updated only after successful source writes.
- Expired cursor state falls back safely.
- No external provider write-action path is introduced.
- `npm run verify:phase0` passes.
