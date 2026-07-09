# Provider-Derived Workday Sources Phase 4B Implementation Plan

Date: 2026-07-09

Spec: `docs/superpowers/specs/2026-07-09-provider-derived-workday-sources-phase-4b-design.md`

## Objective

Make Phase 4 workday generation prefer normalized provider-derived source
records stored in OneBrain, with deterministic Phase 4A fallback data used only
when no usable provider records exist.

OneBrain remains the main database for source records and generated workday
artifacts. Assistant Postgres remains operational provider sync state only.

## Step 1: Contract Vocabulary

- Add explicit OneBrain record types for:
  - `provider_message`
  - `provider_calendar_event`
- Keep both records under purpose `assistant_workday`.
- Add or reuse intent labels so provider source records can be queried and
  audited separately from generated workday artifacts.

## Step 2: Source Record Writers

- Add OneBrain writer helpers in `providers/onebrain_events.py`:
  - `record_provider_message_source`
  - `record_provider_calendar_event_source`
- Include scope, provider, provider account reference, stable source reference,
  local date, normalized timestamps, safe text, trust metadata, correlation, and
  provenance.
- Exclude OAuth tokens, refresh tokens, secret headers, raw HTML, MIME payloads,
  and provider webhook secrets.

## Step 3: Provider Sync Producer

- Extend `ProviderSyncProcessor` so successful sync jobs write normalized
  provider source records into OneBrain.
- In local/dev mode, produce deterministic provider-derived source records from
  connected account state through the same writer path.
- Record provider health degradation if source normalization fails.
- Keep cursor and subscription persistence in Assistant Postgres.

## Step 4: Workday Source Collector

- Update `WorkdaySourceCollector` to accept OneBrain and query source records
  before fixtures.
- Convert `provider_message` and `provider_calendar_event` records into
  `WorkdaySourceItem` values.
- Set partial-state `generated_from` to:
  - `onebrain_provider_records` when OneBrain source records are used
  - `deterministic_fallback` when fixtures are used
- Add missing or stale source reasons from provider account, cursor, and sync
  health state.

## Step 5: Workday Processor Wiring

- Pass the OneBrain client into the collector.
- Preserve the Phase 4A snapshot, endpoint, and UI response contracts.
- Ensure generated artifacts keep source refs pointing back to provider source
  records when live records are used.

## Step 6: Tests

- Add provider sync tests proving message and calendar source records are
  written to OneBrain.
- Add safety tests proving source records do not include raw secret material.
- Add workday tests proving provider records are preferred over fallback
  fixtures.
- Add fallback/stale tests proving missing source state remains explicit.
- Keep existing Phase 4A endpoint and worker tests passing.

## Step 7: Verification

- Run focused backend tests for provider sync and workday generation.
- Run formatting/lint checks if touched files require them.
- Run `npm run verify:phase0`.

## Completion Criteria

- Provider sync creates OneBrain `provider_message` and
  `provider_calendar_event` records.
- Workday generation reads those records before using fixtures.
- Fallback and stale states are explicit in partial-state metadata.
- No provider write-action path is introduced.
- `npm run verify:phase0` passes.
