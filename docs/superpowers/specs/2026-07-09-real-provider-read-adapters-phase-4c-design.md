# Real Provider Read Adapters Phase 4C Design

Date: 2026-07-09

## Context

Phase 4B made OneBrain the durable source-record layer for workday generation.
Provider sync now writes normalized `provider_message` and
`provider_calendar_event` records into OneBrain, and the workday loop prefers
those records before deterministic fallback data.

The remaining gap is the fetch layer. Phase 4B still produces local
provider-derived skeleton records during sync. Phase 4C adds real read adapters
for Google and Microsoft so live provider data can populate the same OneBrain
source-record contract.

OneBrain remains the main database and durable source of truth for provider
source records and generated workday artifacts. Assistant Postgres remains
operational state only: provider accounts, token secret refs, jobs, cursors,
subscriptions, retries, and health.

## Goal

Add provider-specific read adapters behind a common normalized fetch interface:

- Google Gmail message reads.
- Google Calendar event reads.
- Microsoft Graph message reads.
- Microsoft Graph calendarView event reads.
- Safe mapping from provider payloads to Phase 4B OneBrain source writers.
- Local/test fallback only when live provider reads are unavailable or when the
  account uses local test tokens.

## Approaches Considered

The recommended approach is a provider adapter interface with Google and
Microsoft implementations. It keeps sync orchestration stable and limits
provider-specific HTTP mapping to one module.

An inline implementation inside `providers/sync.py` would be faster to write,
but would mix HTTP calls, token handling, source normalization, cursor updates,
and OneBrain writes in one file.

A full provider SDK integration would reduce some manual HTTP handling, but it
adds new dependencies and a larger surface area before the product needs write
actions or advanced delta-sync behavior.

## Provider API Shape

Use direct HTTP calls with bearer access tokens retrieved from the operational
secret provider.

Google:

- Gmail list: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages`
- Gmail get: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}`
  with metadata headers for subject, from, to, date, and message id
- Calendar list:
  `GET https://www.googleapis.com/calendar/v3/calendars/primary/events`
  with `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`, and a
  small `maxResults`

Microsoft:

- Messages:
  `GET https://graph.microsoft.com/v1.0/me/messages`
  with `$select`, `$top`, and order/received filters where supported
- Calendar:
  `GET https://graph.microsoft.com/v1.0/me/calendarView`
  with `startDateTime` and `endDateTime`

All adapters use read-only OAuth scopes only. Phase 4C does not request,
require, or use write scopes.

## Normalized Fetch Contract

Add internal dataclasses for normalized provider payloads:

- `FetchedProviderMessage`
- `FetchedProviderCalendarEvent`
- `ProviderFetchResult`

The fetch result contains safe, normalized fields only:

- stable provider item id
- source ref
- local date
- title or subject
- safe snippet/detail
- sender/organizer
- recipients or attendee count
- received/start/end timestamps
- unread/importances/busy hints
- rule-friendly flags

The result does not contain OAuth tokens, refresh tokens, raw MIME payloads,
raw HTML bodies, authorization headers, cookies, webhook secrets, or complete
provider payloads.

## Sync Flow

Provider sync keeps the Phase 4B sequence:

1. Resolve the provider account from Assistant Postgres.
2. Confirm OneBrain is available.
3. Retrieve the token payload from the operational secret provider.
4. Fetch provider messages and calendar events through the adapter.
5. Normalize results and write them to OneBrain through Phase 4B writers.
6. Advance cursor state in Assistant Postgres.
7. Record provider health.

If a live adapter cannot run because a test token is used, credentials are
missing, the provider returns an auth error, or an HTTP request fails, sync must
fall back to Phase 4B deterministic local source records and record a degraded
source detail. It must not write raw error bodies or token values to OneBrain.

## Token Handling

Token payloads remain in the operational secret provider. Phase 4C may read the
stored access token for provider HTTP requests. It must not write token payloads
or secret refs into workday source records.

Refresh-token rotation is out of scope. If the access token is expired or
provider auth fails, sync marks provider health degraded and uses local fallback
records so the UI still has explicit partial-state metadata.

## OneBrain Alignment

All live provider data enters the assistant through OneBrain source records.
The workday loop never reads raw provider payloads directly. Generated workday
artifacts keep source refs pointing back to OneBrain provider source records.

Assistant Postgres stores only operational state and encrypted secret refs. It
does not store durable message or calendar content.

## Error Handling

- Missing token secret: mark sync degraded and use local fallback.
- Local/test token: use local fallback and keep sync healthy for local dev.
- Provider auth failure: mark sync degraded and use local fallback.
- Provider HTTP timeout or malformed payload: skip malformed items, use any
  usable normalized items, and mark source state degraded.
- OneBrain unavailable: pause sync as in Phase 4B; do not claim durable source
  writes.

## Testing

Backend tests should cover:

- Google adapter maps Gmail and Calendar payloads into normalized source
  records.
- Microsoft adapter maps Graph message and calendarView payloads into
  normalized source records.
- Sync passes token payloads only to adapter HTTP requests, never to OneBrain.
- Local/test tokens still produce deterministic local records.
- Provider HTTP/auth failures degrade provider health without provider write
  actions.
- Workday generation continues to read OneBrain source records.

Final verification target remains:

- `npm run verify:phase0`

## Acceptance Criteria

Phase 4C is complete when:

- Provider sync can populate OneBrain source records from real Google reads.
- Provider sync can populate OneBrain source records from real Microsoft reads.
- Local/dev tests still work without production provider credentials.
- No raw token, secret, MIME payload, raw HTML, or authorization header is
  written to OneBrain.
- Provider failures are explicit in health/partial state.
- Phase 4A and 4B API/UI contracts remain stable.
- No external email/calendar write path is introduced.
