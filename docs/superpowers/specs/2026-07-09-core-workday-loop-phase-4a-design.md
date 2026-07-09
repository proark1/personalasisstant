# Core Workday Loop Phase 4A Design

Date: 2026-07-09

## Context

Phase 4A is the first implementation slice of Phase 4: Core Workday Loop.

Phase 3 added Google and Microsoft provider connection foundations, read-only
scope tracking, sync/subscription job plumbing, provider health, and OneBrain
provenance writes. Phase 4A turns that foundation into the first useful daily
assistant loop without adding provider write actions.

OneBrain remains the main database and durable source of truth for assistant
memory, workday artifacts, priorities, extracted facts, provenance, retention,
and audit-of-record. Assistant Postgres remains operational state only: jobs,
leases, retry state, sync cursors, subscriptions, transient cache metadata, and
idempotency.

## Goal

Build the first shippable workday loop:

- Generate a stored morning brief artifact.
- Produce explainable priority items.
- Classify inbox items into reviewable triage groups.
- Extract follow-up and commitment risks.
- Detect calendar pressure, conflicts, overload, and useful free-slot windows.
- Replace hardcoded Today data with generated or retrieved workday artifacts.
- Add Inbox Review, Follow-Ups, and Calendar Plan API/UI surfaces backed by
  Phase 4 contracts.
- Preserve partial states when OneBrain, provider sync, Telegram, or model
  providers are unavailable.

## Non-Goals

Phase 4A does not send emails, forward emails, delete mail, write labels, create
external calendar events, edit provider calendars, or execute autonomous
external actions.

Phase 4A does not implement full onboarding, search-first settings, weekly
review, deep relationship intelligence, voice, meeting-prep jobs, or advanced
teaching loops. Those remain later Phase 4 slices or Phase 5+ work.

Phase 4A does not require real production Google/Microsoft credentials to work
locally. It must support deterministic local fallback data while preserving the
same OneBrain ownership and provider-health semantics used in production.

## Product Scope

Phase 4A adds four user-facing surfaces.

### Today

Today answers "what should I do now?" from generated workday artifacts:

- now/next status
- top three priorities with short explanations
- calendar risks
- waiting-on risks
- approval count
- one proactive suggestion
- stale-provider and partial-brief indicators

### Inbox Review

Inbox Review presents triaged items with source provenance:

- priority messages
- waiting-on or needs-reply items
- newsletters/noise
- private or sensitive flags
- explanation for the category
- lightweight correction affordances represented in the API, even if only basic
  UI controls ship in Phase 4A

### Follow-Ups

Follow-Ups shows commitments and risks:

- waiting-on people
- user commitments
- due or stale threads
- confidence and reason
- source references into OneBrain

### Calendar Plan

Calendar Plan shows more than empty slots:

- overloaded days
- conflicts or tight turnarounds
- protected focus windows
- free-slot quality
- low-priority move candidates
- prep/follow-up buffer recommendations

## Backend Architecture

Add a `workday` domain boundary under `assistant_runtime.domain` and
`assistant_runtime.providers`.

Core components:

- `WorkdayLoopProcessor`: orchestrates generation of a workday snapshot for one
  scoped user and date.
- `WorkdaySourceCollector`: reads provider account health and OneBrain records
  needed for the current workday. In Phase 4A it may use deterministic local
  samples when live provider-derived records are unavailable.
- `InboxTriageEngine`: cheap rules-first classifier for inbox items.
- `PriorityEngine`: explainable scorer for top priorities.
- `FollowUpExtractor`: deterministic commitment/waiting-on extractor for
  structured source items.
- `CalendarInsightPlanner`: conflict, overload, free-slot, and focus-window
  detector.
- `WorkdayArtifactStore`: facade for writing and reading durable workday
  artifacts through OneBrain.

The processor must be deterministic enough for tests. Model-provider calls are
optional and must sit behind existing provider interfaces; rules-based behavior
is the Phase 4A default.

## Data Model

Add Pydantic models for:

- `WorkdaySnapshot`
- `WorkdayBrief`
- `PriorityItem`
- `InboxTriageItem`
- `FollowUpRisk`
- `CalendarInsight`
- `CalendarFocusWindow`
- `WorkdayPartialState`
- `TeachingSignal`

Each durable artifact must carry:

- `scope`
- `local_date`
- `source_refs`
- `generated_at`
- `confidence`
- `provenance`
- `partial_state`

OneBrain record types/purposes should stay explicit:

- `workday_brief` with purpose `assistant_workday`
- `priority_item` with purpose `assistant_workday`
- `inbox_triage` with purpose `assistant_workday`
- `follow_up_risk` with purpose `assistant_workday`
- `calendar_insight` with purpose `assistant_workday`
- `teaching_signal` with purpose `assistant_feedback`

Postgres may cache generation job state, local run status, and idempotency keys,
but not durable workday memory or user-corrected business facts.

## API Design

Add read endpoints:

- `GET /v1/workday/today`
- `GET /v1/workday/brief`
- `GET /v1/workday/inbox`
- `GET /v1/workday/follow-ups`
- `GET /v1/workday/calendar`

Add generation endpoint:

- `POST /v1/workday/regenerate`

`/v1/today` should become a compatibility wrapper over the Phase 4A workday
snapshot rather than hardcoded sample data.

Endpoint responses must include partial-state metadata so the UI can show
stale, missing, or degraded provider/model states.

## Worker And Scheduling

Add job types:

- `workday.brief.generate`
- `workday.brief.regenerate`
- `workday.inbox.triage`
- `workday.calendar.plan`
- `workday.followups.extract`

Phase 4A ships:

- manual regeneration through API
- scheduled morning brief job support using existing scheduler abstractions
- worker execution with retries and degraded partial output

The default local schedule can remain disabled unless explicitly configured.
Production scheduling should use user-local timezone defaults, with 7am as the
initial morning brief target.

## OneBrain Alignment

Phase 4A treats OneBrain as mandatory for durable artifacts.

If OneBrain is available:

- generated artifacts are written to OneBrain before being returned as durable
  workday state
- API reads prefer OneBrain records
- generation records provenance and partial-state metadata

If OneBrain is unavailable:

- generation can return an ephemeral degraded response
- no generated workday facts are treated as durable
- worker jobs retry instead of marking durable generation complete
- UI shows partial/degraded state

Provider-derived snippets are untrusted source data. They can influence
classification and summaries only after normalization and extraction. They
cannot create external provider actions in Phase 4A.

## Frontend Design

The first screen remains the operational Today workspace, not a landing page.

Update the existing shell rather than replacing it:

- Today: real workday snapshot, priority explanations, provider stale states,
  and one proactive suggestion.
- Inbox Review: dense triage list optimized for scanning.
- Follow-Ups: commitments and waiting-on risks grouped by urgency.
- Calendar Plan: conflict, overload, focus-window, and free-slot-quality
  panels.

The UI should stay light, calm, and work-focused. Use existing typography,
spacing, and icon button patterns. Avoid marketing layout, oversized hero
composition, decorative cards inside cards, and one-note color changes.

## Error Handling

Phase 4A must return useful partial states:

- OneBrain unavailable: no durable artifact write; API returns degraded
  ephemeral fallback where appropriate.
- Provider disconnected: generated artifact notes missing provider source.
- Provider stale: output includes stale indicator and last successful sync.
- Model unavailable: rules-first generation proceeds with lower confidence.
- Worker retry/dead-letter: status appears in health/partial metadata.

No failure should silently return hardcoded happy-path data.

## Testing

Backend tests:

- Workday generation writes durable artifacts to OneBrain when available.
- OneBrain unavailable returns degraded ephemeral responses and does not mark
  durable generation complete.
- `/v1/today` uses Phase 4A snapshot data.
- Inbox, follow-up, and calendar endpoints return typed empty/partial states.
- Worker processes manual regeneration jobs idempotently.
- Provider stale/disconnected state appears in partial metadata.

Frontend tests/build checks:

- generated OpenAPI client compiles
- Today renders generated workday data
- Inbox Review, Follow-Ups, and Calendar Plan render empty, partial, and normal
  states without layout overlap

Verification target remains:

- `npm run verify:phase0`

## Acceptance Criteria

Phase 4A is complete when:

- A user can open Today and see generated workday state instead of hardcoded
  sample data.
- A manual regenerate call creates or refreshes a OneBrain-backed workday
  snapshot when OneBrain is available.
- Inbox Review, Follow-Ups, and Calendar Plan have real API contracts and web
  surfaces.
- The system produces at least one brief, three priority slots, one follow-up
  risk slot, and one calendar insight slot from deterministic local or
  provider-derived input.
- Partial/degraded states are explicit when OneBrain or providers are
  unavailable.
- No external email/calendar write path is introduced.
- Postgres remains operational state only.

## Rollout Notes

Before production use, run the Phase 3 live-provider gate:

- connect one real Google or Microsoft account
- process initial sync/subscription jobs
- confirm OneBrain receives provider account, scope grant, cursor,
  subscription, and health records

Phase 4A can still be implemented and verified locally before that gate by
using deterministic fallback source items and in-memory OneBrain.
