# OneBrain Assistant Implementation Plan Review

Date: 2026-07-08

## Scope

This review checks the current OneBrain Assistant implementation plan after the architecture update to the OneBrain hybrid pattern:

- Next.js/React/TypeScript web shell.
- Python/FastAPI API.
- Python worker using the same backend package as the API.
- Postgres for operational state.
- Redis for queueing, scheduler wakeups, locks, retries, and dead-letter jobs.
- OneBrain for durable business data, memory, permissions, retrieval, privacy, and audit-of-record.

## Overall Verdict

The plan is now directionally strong and much safer than the first version. The biggest architecture decision is correct: build a modular monolith with one backend codebase, a separate worker process, Postgres operational state, Redis job infrastructure, and OneBrain as the durable data layer.

The remaining risk is not the stack. The risk is boundary precision. The plan needs sharper definitions for:

- Which data lives in Postgres versus OneBrain.
- Which service owns auth/session decisions.
- Which actions can be approved through Telegram versus web only.
- How secrets are encrypted, rotated, and revoked.
- How queues, retries, outbox rows, and worker leases behave under crashes.
- How the UX makes risk, uncertainty, and provider failure visible without overwhelming users.

Do not start implementation until the P0 issues below are resolved in the plan.

## Scorecard

| Area | Status | Notes |
|---|---|---|
| Architecture shape | Strong | Modular monolith plus worker is the right shape for speed and reliability. |
| Language choice | Strong | Python/FastAPI plus Next.js matches current OneBrain direction. |
| OneBrain alignment | Good | Plan now follows OneBrain's hybrid pattern, but data ownership needs a formal matrix. |
| Security posture | Good but incomplete | Prompt-injection, outbox, approvals, and secrets are present, but implementation rules/tests are not concrete enough. |
| Reliability | Good direction | Outbox, idempotency, Postgres, Redis, and reconciliation are present. Job durability details still need design. |
| OAuth/connectors | Good direction | Scope tiers and sync architecture are present. Verification/admin-consent and webhook edge cases remain open. |
| UI/UX | Medium | Product surfaces are right, but onboarding, approval cards, notification fatigue, and failure states need much more detail. |
| GDPR/compliance | Medium | Portability and data residency are recognized, but provider risk choices need to be surfaced earlier. |
| MVP scope | Risky | Google + Microsoft + Telegram + voice + German/English + high security is a lot for a first shippable slice. |
| Testing strategy | Weak | Needs explicit security, workflow, sync, outbox, UX, and provider-failure tests. |

## P0 Issues To Fix Before Coding

### 1. Data Ownership Boundary Is Still Too Easy To Misread

The plan now says OneBrain owns business data while Postgres owns operational state. Good. But several entities are naturally both operational and business-relevant: action proposals, action approvals, sync subscription metadata, provider health, audit events, Telegram messages, and feedback.

Risk:

- Two sources of truth.
- GDPR export/delete gaps.
- A crash recovery path that disagrees with OneBrain audit.
- Developers guessing per table.

Fix:

Add a data ownership matrix before implementation:

| Entity | Postgres | OneBrain |
|---|---|---|
| OAuth refresh token | encrypted value or secret reference | secret reference and scope grant metadata |
| Sync cursor/history ID/delta token | operational cursor value | reconciliation/audit summary |
| Action state | state machine, lease, retry, outbox | proposal, approval, final execution fact, provenance, audit-of-record |
| Email body summary | cache if needed | durable captured message/memory subject to permissions |
| Telegram inbound message | delivery/callback state | durable channel provenance and conversation memory |
| Provider health event | operational retry/debug state | high-level user-visible/degradation event if relevant |

### 2. Auth And Session Architecture Is Not Defined Enough

The plan says the assistant API handles auth/session handoff, but does not decide whether the assistant owns auth, delegates to OneBrain, or shares a session model.

Risk:

- Duplicate identity systems.
- Different account/space scopes in OneBrain and assistant.
- Telegram approvals tied to the wrong user/session.
- Native app migration blocked by cookie-only auth.

Fix:

Define one identity flow:

- Web auth source of truth.
- Account/space/user IDs passed to the assistant.
- How assistant validates OneBrain permissions.
- How Telegram chat binding maps to a verified OneBrain user.
- Which actions require fresh web auth instead of Telegram approval.
- Token-based auth path for future iOS/Android.
- Session revocation, CSRF/origin checks, CSP, and secure cookie rules.

### 3. Secret Management Needs A Concrete Key Strategy

`SecretProvider` is present, but not enough.

Risk:

- OAuth refresh tokens and Telegram bot tokens become the highest-value target.
- Token rotation/revocation is forgotten.
- Debug logs leak tokens or message content.
- Self-hosted deployments get a weak local secret story.

Fix:

Specify:

- Envelope encryption.
- Per-user or per-account data keys where practical.
- Master key source per environment: Railway variable first, KMS/secret manager later.
- Secret versioning and rotation.
- Token revocation on disconnect.
- Redaction rules for logs, traces, errors, and support exports.
- Backup/restore behavior for encrypted secrets.

### 4. Prompt-Injection Defense Needs Testable Implementation Rules

The principles are good, but the plan still lacks a concrete test matrix.

Risk:

- Sanitizer misses hidden text, Unicode directionality, quoted HTML, ICS invite fields, attachments, or forwarded message chains.
- A model-generated draft uses untrusted content as an instruction.
- Hidden egress attempts pass through because the only defense is a prompt.

Fix:

Add a security test suite from Phase 0:

- HTML hidden text.
- Zero-size text.
- White-on-white text.
- CSS display-none.
- Invisible Unicode and directionality markers.
- Calendar invite injection.
- Attachment text injection.
- Forwarded/replied email chain injection.
- Reply-To spoofing.
- New-recipient exfiltration.
- "Ignore previous instructions" style payloads.
- Distribution-list and BCC edge cases.

### 5. Approval Security Needs Risk Tiers

The plan allows Telegram approvals for eligible actions, but does not define eligibility strongly enough.

Risk:

- Stolen Telegram account approves sensitive actions.
- A low-friction channel becomes the weak point for external sends.
- User cannot tell exactly what will happen before approving.

Fix:

Define action risk tiers:

- Low risk: reminders, internal labels, local follow-up tasks.
- Medium risk: draft creation, calendar holds, internal notifications.
- High risk: sending email, forwarding, inviting external attendees, deleting, changing external meetings.

Rules:

- High-risk actions require web approval or fresh-auth hard confirmation.
- Telegram can approve only low/medium risk by default.
- Approval cards must show recipients, source account, source excerpt, changed fields, risk flags, and why approval is required.
- "Approve" must never be the visually dominant default for high-risk actions.

### 6. Queue, Scheduler, And Job Durability Are Not Specific Enough

Redis is useful, but Redis-only jobs can still be fragile depending on configuration.

Risk:

- A brief or action disappears after a Redis issue.
- A worker crash leaves a job stuck.
- Multiple workers process the same subscription renewal or action.

Fix:

Use Postgres as the durable job/outbox source of truth and Redis as wakeup/lock/fast queue infrastructure, or require Redis persistence and a clear recovery story.

Specify:

- Job table schema.
- Lease timeout.
- Retry backoff.
- Dead-letter handling.
- Idempotency key format.
- Outbox state transitions.
- Worker heartbeat.
- Recovery after API crash, worker crash, Redis restart, and Postgres failover.

### 7. OAuth And Provider Verification Are Launch Risks

The plan has scope tiers, but not provider approval realities.

Risk:

- Google OAuth verification delays launch.
- Microsoft admin consent blocks business users.
- Gmail Pub/Sub setup adds Google Cloud complexity.
- OAuth callback design does not work in native wrappers later.

Fix:

Add launch-readiness tasks:

- Exact Google scopes by feature.
- Exact Microsoft delegated permissions by feature.
- Google verification requirements.
- Microsoft tenant/admin consent handling.
- OAuth app branding.
- Local/test OAuth strategy.
- Callback/deep-link pattern for browser, PWA, and native.
- Disconnect/revoke/reconnect flows.

### 8. Data Residency And Provider Disclosure Need Earlier UX

The plan acknowledges GDPR hardening later, but MVP already uses Google, Microsoft, Telegram, Gemini, and Railway.

Risk:

- Users assume EU/private handling that is not true.
- Telegram receives sensitive summaries by default.
- Voice provider choices conflict with DACH/GDPR expectations.

Fix:

Add an MVP privacy/provider disclosure screen:

- Which providers process which data.
- Which data may leave the EU.
- Which Telegram categories are enabled.
- Whether full content is sent to Telegram.
- Gemini voice/LLM processing note.
- Self-hosted/EU mode status.

## P1 Issues To Fix During MVP Design

### 9. Onboarding Needs A Real Flow

The plan lists surfaces, but not the first 10 minutes.

Recommended flow:

1. Login or connect to OneBrain account/space.
2. Choose language and timezone.
3. Connect Telegram with BotFather tutorial.
4. Connect email/calendar read-only.
5. Show first brief from a small safe sample.
6. Ask for optional scope upgrades only when needed.
7. Set Telegram defaults and sensitive-content preferences.
8. Show the first action proposal with an approval card.

### 10. Notification Fatigue Is A Product Risk

Telegram is required. That is fine for this product direction, but default updates must be careful.

Fix:

- Digest first, interrupt only for urgent/VIP/conflict/approval.
- Quiet hours by default.
- Per-category toggles.
- "Too much / too little" feedback on every brief.
- Escalation policy for repeated ignored notifications.

### 11. Multi-Account UX Is Underspecified

Business users often connect Workspace, private Gmail, Microsoft, and multiple calendars.

Fix:

- Every item shows account/source.
- Merged brief explains conflicts across accounts.
- User can exclude private account from work brief.
- Calendar free/busy can include private details without exposing event titles.
- Sending account is explicit on every draft.

### 12. Voice Is Still Scope Pressure

The plan wisely limits MVP voice to read-only/proposal-only, but it is still expensive.

Fix:

- Ship text and Telegram first internally.
- Add push-to-talk after approval/action flow works.
- Require text fallback for every voice interaction.
- Measure latency and German transcription quality before making voice central in the demo.

### 13. Observability Needs Redaction Rules

The plan asks for logs/traces/model usage, but logs must not become a data leak.

Fix:

- Log IDs and metadata by default, not email bodies.
- Store content excerpts only when explicitly needed and classified.
- Redact tokens, headers, cookies, email addresses where possible.
- Correlate actions with source IDs and hashes rather than full content.

### 14. Operational Migrations Are Missing

Postgres is now central. Schema changes need a migration discipline.

Fix:

- Use Alembic or a lightweight migration runner from day one.
- No "create tables on import" for production.
- Migration status visible in operator/deploy docs.
- Backups and restore drills before real data.

### 15. OneBrain Availability Needs A Failure Policy

If OneBrain is down, the assistant must know what it can still do.

Fix:

- If OneBrain cannot write audit/provenance, block external side effects.
- Allow read-only cached UI only with visible stale warnings.
- Queue non-risky captures for replay only if policy allows.
- Do not execute sends/calendar writes without OneBrain audit availability.

### 16. Testing Strategy Needs To Become A First-Class Phase 0 Deliverable

Add tests for:

- Action state transitions.
- Outbox crash/retry behavior.
- Duplicate Telegram and web approvals.
- OAuth scope upgrade/downgrade.
- Sync missed-event reconciliation.
- Prompt-injection fixtures.
- Egress recipient blocking.
- Secret redaction.
- Mobile layout screenshots.
- German and English UI strings.
- Provider failure/429 partial briefs.

## UI/UX Review

What is good:

- Surfaces are simple and business-focused.
- Telegram as a private assistant chat matches how many users want updates.
- Mobile-first and app-ready constraints are now present.
- Voice is constrained enough for MVP safety.

Weak spots:

- No wireframe-level definition of Today, approval cards, settings, or onboarding.
- Approval UX is the most important screen and needs exact content.
- Provider errors must be calm and visible, not buried in settings.
- Users need a "why am I seeing this?" explanation for triage and follow-up items.
- Users need a "teach the assistant" feedback affordance from day one.
- German/English support means more than translation: dates, time, tone, formal/informal German, and locale-specific calendar language matter.

## Security Review

Strong pieces:

- Prompt-injection defense is now foundational.
- Untrusted content cannot directly drive tools.
- Human approval remains the V1 floor.
- Outbox and idempotency give the approval promise a mechanism.
- Telegram is abstracted as a notification channel.
- Secrets are recognized as day-one infrastructure.

Remaining issues:

- Exact sanitizer/parser behavior is unspecified.
- Approval channel risk tiers are missing.
- Key rotation and token revocation are missing.
- Auth/session handoff is missing.
- Provider scopes and verification are not detailed enough.
- Egress rules need contact, alias, BCC, distribution-list, and reply-to handling.
- Data residency and sub-processor disclosure need earlier UX.

## Reliability Review

Strong pieces:

- Push-first sync with reconciliation fallback is right.
- Outbox is right.
- Postgres operational state plus Redis execution infrastructure is right.
- Worker-first product model is right.

Remaining issues:

- Job durability design is not specific enough.
- Worker lease and heartbeat behavior are not specified.
- Redis persistence/failure story is not specified.
- Migrations and backups are missing.
- OneBrain downtime policy is missing.
- Provider rate-limit budgets are conceptual, not operational.

## Architecture Review

Strong pieces:

- The plan now matches OneBrain's Python/FastAPI plus Next.js direction.
- Avoiding TypeScript/NestJS backend is the right call unless OneBrain changes.
- API/worker split is right.
- No LLM calls in request path is right.
- Provider interfaces are comprehensive.

Remaining issues:

- The data ownership matrix must be explicit.
- The assistant repo versus OneBrain repo contract workflow needs concrete file/package boundaries.
- The worker queue implementation needs a selected library or a simple in-house Postgres leasing pattern.
- OperationalStore should not grow into a shadow OneBrain.
- OpenAPI generation should be a required CI check.

## Recommended Next Plan Edits

Before implementation, add these sections to the implementation plan:

1. Data Ownership Matrix.
2. Auth And Session Architecture.
3. Secret Encryption And Rotation Strategy.
4. Action Risk Tiers And Approval Channel Rules.
5. Queue, Lease, Outbox, And Worker Recovery Design.
6. Provider OAuth Launch Checklist.
7. MVP Onboarding Flow.
8. Security Test Matrix.
9. Operational Migration And Backup Strategy.
10. OneBrain Downtime And Audit Availability Policy.

## Suggested Build Order

1. OneBrain assistant contracts and SDK/client additions.
2. Assistant repo foundation: Next.js shell, FastAPI API, Python worker, Postgres, Redis, OpenAPI client, Docker Compose.
3. Operational state: actions, outbox, jobs, leases, idempotency, migrations.
4. SecretProvider and auth/session/Telegram binding.
5. Telegram onboarding and notification preferences.
6. Read-only Google/Microsoft sync with reconciliation.
7. Security pipeline and prompt-injection fixture tests.
8. Today screen with generated stored brief and provider health.
9. Approval cards and draft proposals.
10. Voice read-only/proposal-only layer.

## Bottom Line

The plan is good enough to become a build plan after the P0 design gaps are closed. The stack choice is now clear. The product risk is not "which language"; it is making the assistant safe enough to read email, propose actions, and push Telegram updates without quietly creating a second data brain or a weak approval path.

