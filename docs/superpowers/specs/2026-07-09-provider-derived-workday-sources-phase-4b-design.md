# Provider-Derived Workday Sources Phase 4B Design

Date: 2026-07-09

## Context

Phase 4A shipped the first Core Workday Loop: Today, Inbox Review,
Follow-Ups, and Calendar Plan are generated from workday artifacts and persisted
to OneBrain when available. The remaining gap is the source layer. Phase 4A can
operate from deterministic local source items so the product is usable without
production provider credentials, but the daily loop should now prefer
provider-derived records written into OneBrain.

OneBrain remains the main database and durable source of truth. Assistant
Postgres remains operational state only: provider accounts, jobs, cursors,
subscription state, retry state, and other transient sync metadata.

## Goal

Build the OneBrain-backed provider source pipeline for workday generation:

- Normalize provider sync outputs into safe source records.
- Store normalized message and calendar event source records in OneBrain.
- Teach the workday source collector to read OneBrain provider records first.
- Keep deterministic fallback data only when no usable OneBrain provider source
  records exist.
- Mark missing or stale provider states explicitly in workday partial-state
  metadata.
- Preserve the Phase 4A API and UI contracts.

## Non-Goals

Phase 4B does not send email, create calendar events, update labels, delete
messages, edit provider data, or execute autonomous provider actions.

Phase 4B does not require production Google or Microsoft API calls in local
verification. It establishes the normalized OneBrain source-record contract and
sync integration so deeper provider fetchers can be attached later without
changing the workday API.

Phase 4B does not add full semantic search, meeting prep, weekly review,
relationship intelligence, or autonomous drafting.

## Source Record Model

Add explicit OneBrain source record types:

- `provider_message`
- `provider_calendar_event`

Both use purpose `assistant_workday`. They are source records, not generated
assistant conclusions. Workday artifacts produced from them keep references back
to the source record ids or source refs.

Every source record must include:

- account and space scope
- provider name
- provider account reference
- stable source reference
- normalized local date
- normalized title or subject
- safe text summary or snippet
- content trust marker
- sync correlation id
- generated/normalized timestamp

Message metadata may include sender, recipients, received timestamp, unread
status, importance hints, attachment count, and category hints. Calendar event
metadata may include start/end timestamps, attendee count, location presence,
organizer, meeting link presence, and busy/free status.

Raw OAuth tokens, refresh tokens, secret headers, raw MIME payloads, raw HTML,
and provider webhook secrets must never be written to these source records.

## Sync Flow

Provider sync jobs become the source-record producer:

1. Resolve the connected provider account from Assistant Postgres.
2. Confirm OneBrain is available before durable provider-source writes.
3. Advance cursors and subscription state as operational metadata.
4. Normalize provider-derived message and calendar inputs.
5. Write source records to OneBrain with stable source refs and provenance.
6. Record provider health after source-record writes complete.

In local/dev mode, where real provider fetchers may not exist, sync can produce
small deterministic provider-derived source records from connected account
state. These records still travel through the same OneBrain writer and collector
path as production records.

## Workday Collection Flow

`WorkdaySourceCollector` should read OneBrain provider source records first:

1. Query recent `provider_message` and `provider_calendar_event` records for
   the current scope and local date.
2. Convert safe source records into internal `WorkdaySourceItem` values.
3. Use those values for inbox triage, priority scoring, follow-up extraction,
   and calendar planning.
4. Fall back to deterministic Phase 4A fixtures only when no usable provider
   source records exist.
5. Report the source mode in partial-state metadata.

Expected source modes:

- `onebrain_provider_records`: the workday loop used normalized provider source
  records from OneBrain.
- `deterministic_fallback`: no usable provider source records were available,
  so Phase 4A fallback items were used.

## Stale And Missing States

Phase 4B should keep the Phase 4A partial-state contract and make provider
source freshness more precise:

- disconnected provider account: include a missing-source reason
- connected account without source records: include fallback and missing live
  source details
- sync cursor missing or old: include stale-source detail
- provider sync error: include stale-source detail with the provider name
- OneBrain unavailable: return degraded non-durable output as in Phase 4A

Stale detection can use available cursor and health metadata from Assistant
Postgres, but durable workday facts and source records must remain in OneBrain.

## API And UI Compatibility

The existing Phase 4A endpoints remain stable:

- `GET /v1/workday/today`
- `GET /v1/workday/brief`
- `GET /v1/workday/inbox`
- `GET /v1/workday/follow-ups`
- `GET /v1/workday/calendar`
- `POST /v1/workday/regenerate`
- `GET /v1/today`

The web UI should not need a route or layout change for Phase 4B. Existing
partial-state and generated-source fields should show whether the workday view
came from OneBrain provider records or deterministic fallback.

## Error Handling

Provider source writes are best-effort within sync, but must be honest:

- If OneBrain is unavailable, do not claim source records were durable.
- If source normalization fails for one item, skip that item and record provider
  health degradation instead of failing the whole workday loop.
- If no usable source records exist, the workday loop may return fallback data
  only with explicit partial-state metadata.
- If provider sync succeeds operationally but source records are stale or empty,
  workday generation should surface that state instead of silently presenting a
  fully-live view.

## Testing

Backend tests should cover:

- provider sync writes `provider_message` and `provider_calendar_event` records
  into OneBrain
- source records exclude raw tokens, refresh tokens, and secret material
- workday generation prefers OneBrain provider source records over deterministic
  fallback items
- workday generation falls back with explicit partial-state metadata when no
  source records exist
- stale provider cursors or sync errors are represented in partial state

Final verification target remains:

- `npm run verify:phase0`

## Acceptance Criteria

Phase 4B is complete when:

- A connected provider sync writes normalized provider source records to
  OneBrain.
- Workday generation uses OneBrain provider source records before local
  fallback data.
- Fallback data is only used when no usable provider source records exist, and
  the response says so.
- Provider missing/stale state is explicit in workday partial-state metadata.
- Phase 4A API and UI contracts continue to pass unchanged.
- No external provider write path is introduced.
- Postgres remains operational state only, while OneBrain holds provider-derived
  source records and generated workday artifacts.
