# Real Provider Read Adapters Phase 4C Implementation Plan

Date: 2026-07-09

Spec: `docs/superpowers/specs/2026-07-09-real-provider-read-adapters-phase-4c-design.md`

## Objective

Replace Phase 4B's provider-derived skeleton source producer with real
read-capable Google and Microsoft adapters, while preserving OneBrain as the
main durable database for provider source records and generated workday
artifacts.

## Step 1: Normalized Provider Read Models

- Add internal dataclasses for:
  - `FetchedProviderMessage`
  - `FetchedProviderCalendarEvent`
  - `ProviderFetchResult`
- Keep the models safe and normalized; no raw tokens, raw HTML, full provider
  payloads, cookies, authorization headers, or MIME bodies.

## Step 2: Provider Read Client

- Add a provider read module with:
  - Google Gmail and Calendar HTTP fetches
  - Microsoft Graph message and calendarView HTTP fetches
  - local/test-token fallback source generation
- Use direct `httpx` calls with injected transport support for tests.
- Map provider errors into a safe error detail that contains no response bodies
  or token values.

## Step 3: Secret And Worker Wiring

- Pass the operational secret provider into `AssistantWorker`.
- Pass the secret provider into `ProviderSyncProcessor`.
- Retrieve token payloads only inside sync/read code.
- Keep token payloads out of OneBrain metadata and logs.

## Step 4: Sync Integration

- Replace `_provider_message_sources` and `_provider_calendar_sources` as the
  primary source path with adapter results.
- Continue writing source records through Phase 4B OneBrain writers.
- Use deterministic local fallback when the token is local/test, token retrieval
  fails, or provider HTTP reads fail.
- Mark provider health degraded when live reads fail.

## Step 5: Tests

- Unit-test Google payload mapping:
  - Gmail list/get message metadata
  - Calendar event list
- Unit-test Microsoft payload mapping:
  - Graph `/me/messages`
  - Graph `/me/calendarView`
- Worker tests:
  - sync writes real adapter-derived source records
  - local/test tokens still write local fallback records
  - failed provider read degrades health without leaking token text
- Keep Phase 4A/4B workday tests passing.

## Step 6: Verification

- Run focused provider tests.
- Run backend lint.
- Run `npm run verify:phase0`.

## Completion Criteria

- Google and Microsoft read adapters can populate OneBrain source records.
- OneBrain source records never contain raw tokens, secret refs, raw HTML, raw
  MIME, or authorization headers.
- Local development still works without production provider credentials.
- Provider failure states are explicit.
- No provider write-action path is introduced.
- `npm run verify:phase0` passes.
