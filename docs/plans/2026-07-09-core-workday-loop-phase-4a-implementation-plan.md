# Core Workday Loop Phase 4A Implementation Plan

Date: 2026-07-09

Spec: `docs/superpowers/specs/2026-07-09-core-workday-loop-phase-4a-design.md`

## Objective

Implement the first Phase 4A workday loop so Today, Inbox Review, Follow-Ups,
and Calendar Plan are backed by generated workday artifacts instead of hardcoded
sample data.

OneBrain remains the durable source of truth. Assistant Postgres remains
operational state only.

## Step 1: Contracts

- Add workday Pydantic models to `schemas.py`:
  - `WorkdaySnapshot`
  - `WorkdayBrief`
  - `PriorityItem`
  - `InboxTriageItem`
  - `FollowUpRisk`
  - `CalendarInsight`
  - `CalendarFocusWindow`
  - `WorkdayPartialState`
  - endpoint response/request models
- Keep `/v1/today` compatible with the existing web shell while exposing richer
  workday endpoint shapes under `/v1/workday/*`.

## Step 2: OneBrain Artifact Writers

- Add record writers in `providers/onebrain_events.py` for:
  - workday brief
  - priority item
  - inbox triage item
  - follow-up risk
  - calendar insight
- Ensure metadata includes scope, local date, source refs, confidence,
  partial-state, correlation, and provenance.
- Do not store raw provider secrets or raw untrusted content.

## Step 3: Workday Domain

- Add `domain/workday.py` with:
  - deterministic local source fixtures
  - `WorkdaySourceCollector`
  - `InboxTriageEngine`
  - `PriorityEngine`
  - `FollowUpExtractor`
  - `CalendarInsightPlanner`
  - `WorkdayLoopProcessor`
- Rules-first behavior is the default. No model dependency is required for
  Phase 4A.
- If OneBrain is unavailable, return degraded ephemeral output and mark it as
  not durable.

## Step 4: API Routes

- Add:
  - `GET /v1/workday/today`
  - `GET /v1/workday/brief`
  - `GET /v1/workday/inbox`
  - `GET /v1/workday/follow-ups`
  - `GET /v1/workday/calendar`
  - `POST /v1/workday/regenerate`
- Make `/v1/today` delegate to the workday snapshot compatibility mapper.

## Step 5: Worker Path

- Add a `WorkdayJobProcessor`.
- Wire it into `AssistantWorker.run_once`.
- Support job types:
  - `workday.brief.generate`
  - `workday.brief.regenerate`
  - `workday.inbox.triage`
  - `workday.calendar.plan`
  - `workday.followups.extract`
- Manual regeneration should enqueue or process idempotently.

## Step 6: Web UI

- Extend the generated client and handwritten API client.
- Add routes or route-aware rendering for:
  - `/`
  - `/inbox`
  - `/follow-ups`
  - `/calendar`
- Update Today to render generated priorities, risks, and proactive suggestion.
- Add dense, scannable Inbox Review, Follow-Ups, and Calendar Plan surfaces.
- Preserve existing Provider and Telegram panels on Today.

## Step 7: Tests And Verification

- Backend tests:
  - generated workday snapshot writes OneBrain records when available
  - OneBrain unavailable returns degraded non-durable output
  - `/v1/today` is generated from Phase 4A workday data
  - workday endpoints return typed data
  - worker processes workday jobs
- Frontend/build:
  - regenerate OpenAPI client
  - typecheck/lint/build web
- Final verification:
  - `npm run verify:phase0`

## Completion Criteria

- Today no longer depends on hardcoded sample data.
- Workday artifacts are durable only when OneBrain accepts them.
- Inbox Review, Follow-Ups, and Calendar Plan have usable web surfaces.
- Partial/degraded state is visible and test-covered.
- No external provider write path is introduced.
