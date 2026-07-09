# Email And Calendar Connectors Phase 3 Design

Date: 2026-07-09

## Context

This design covers Phase 3 of the OneBrain Assistant implementation plan:
Google and Microsoft email/calendar connector foundations.

Phases 0-2 already established the assistant runtime, operational Postgres,
Redis-backed worker patterns, OneBrain contract boundaries, Telegram binding,
secret storage, action state, outbox, policy, and prompt-injection foundations.

Phase 3 turns provider connectivity into a real product boundary while keeping
the same safety rule: external provider content is untrusted data, and durable
business memory remains in OneBrain.

## Goal

Implement provider-ready Google and Microsoft email/calendar foundations:

- OAuth configuration, start, callback, reconnect, disconnect, and scope
  tracking.
- Encrypted token storage through `SecretProvider`.
- Connected account records with account, provider, scope tier, sync health,
  and provenance metadata.
- Read-only sync job plumbing for Gmail, Google Calendar, Microsoft Outlook
  mail, and Microsoft Calendar.
- Push-first subscription models with renewal jobs, webhook receipt, replay
  deduplication, and reconciliation fallback.
- Sync cursor and delta-token storage in assistant Postgres as operational
  state.
- OneBrain record/audit writes for connected-account facts, scope grants, sync
  subscriptions, cursor references, provider health, and captured sample
  message/event metadata.
- UI/API surfaces that show connected accounts, granted scopes, provider
  health, and which future features require scope upgrades.

## Non-Goals

This phase does not ship user-facing email sending, forwarding, external
calendar writes, draft send, event write, or scheduling execution.

This phase may expose connector methods for draft/event-draft capability behind
interfaces, but no irreversible provider write can be reached from UI, worker,
webhook, model output, or Telegram.

This phase does not require committing real Google or Microsoft OAuth secrets.
Those remain environment variables in local `.env` or Railway variables.

## Provider Scope Strategy

Start read-only and make write scopes explicit upgrades.

Google read tier:

- Gmail read tier uses `https://www.googleapis.com/auth/gmail.readonly` when
  body access is needed.
- Gmail metadata-only experiments may use
  `https://www.googleapis.com/auth/gmail.metadata`.
- Google Calendar read tier uses calendar read scopes for event and
  availability sync.

Google upgrade tiers:

- Gmail draft/compose/send scopes are stored as capability metadata but are not
  used for user-facing sends in Phase 3.
- Google Calendar write scopes are stored as capability metadata but are not
  used for external event writes in Phase 3.

Microsoft read tier:

- Microsoft Graph delegated mail read uses `Mail.Read`.
- Microsoft Graph delegated calendar read uses `Calendars.Read`.

Microsoft upgrade tiers:

- `Mail.ReadWrite`, `Mail.Send`, and `Calendars.ReadWrite` are represented as
  future capability tiers only.

The settings and account-status API must show granted scopes, missing scopes,
and the feature names that require upgrades.

## Architecture

The assistant API owns OAuth entrypoints, provider webhooks, account status, and
enqueueing sync work. The worker owns subscription creation/renewal,
reconciliation, cursor advancement, provider fetches, sanitization,
contract-validation, and OneBrain writes.

No provider fetch, model call, or provider write is required to complete an
ordinary web request. OAuth callbacks store encrypted credentials, write
operational account state, prepare OneBrain provenance, and enqueue initial
sync/subscription jobs.

Provider implementations sit behind connector interfaces:

- `EmailConnector`
- `CalendarConnector`
- `SyncProvider`
- `OAuthProvider`

The first concrete adapters are:

- `GoogleMailConnector`
- `GoogleCalendarConnector`
- `MicrosoftMailConnector`
- `MicrosoftCalendarConnector`

Each adapter receives secret references and operational cursor records. Raw
access tokens, refresh tokens, provider webhook secrets, and client secrets are
never written to OneBrain or returned to the browser.

## Operational Data

Assistant Postgres owns execution and recovery state:

- Provider OAuth sessions and state nonces.
- Encrypted refresh-token secret references.
- Access-token cache references or short-lived encrypted values when needed.
- Connected provider account IDs.
- Granted scope sets and scope tier.
- Sync cursor values: Gmail `historyId`, Google Calendar `syncToken`,
  Microsoft Graph `@odata.deltaLink`, Microsoft folder/calendar cursor refs.
- Provider subscription IDs, resource refs, expiration, renewal job refs,
  webhook channel tokens, and replay-dedupe keys.
- Sync job state, lease, retry count, rate-limit pause, and dead-letter reason.
- Provider health/error state needed for operations.

OneBrain owns durable user-visible facts and audit-of-record:

- Connected account facts.
- Scope grants and secret references.
- Sync subscription metadata and cursor references, not raw cursor secrets if
  treated as operational.
- Captured message/event records, summaries, provenance, retention, and
  classification.
- Provider health and degradation events.
- Assistant audit entries for OAuth, sync, subscription renewal, reconciliation,
  and content capture decisions.

## OAuth Flow

1. User chooses Google or Microsoft account connection from settings/onboarding.
2. API creates an OAuth state nonce tied to account, user, space, provider,
   requested scope tier, redirect target, and expiry.
3. User completes OAuth with Google or Microsoft.
4. Callback validates state, provider response, and expected redirect.
5. API stores refresh token and related sensitive values through
   `SecretProvider`.
6. API writes or updates operational connected-account state.
7. API records OneBrain connected-account, scope-grant, and secret-reference
   facts.
8. API enqueues initial read-only sync and subscription setup jobs.
9. UI shows the account as connected with pending sync health until workers
   complete the first pass.

Disconnect revokes provider tokens where possible, revokes local secret
references, cancels or marks subscriptions inactive, pauses sync jobs, writes
OneBrain audit, and marks provider health disconnected.

Scope downgrade cancels or revalidates pending proposals that require removed
scopes.

## Sync And Subscription Flow

### Gmail

Gmail uses `users.watch` where configured, stores `historyId`, and handles push
notifications by enqueueing reconciliation with `users.history.list`.

If Pub/Sub is unavailable locally, the connector can run polling reconciliation
jobs using the stored cursor.

### Google Calendar

Google Calendar uses watch channels where configured. Each watched calendar has
its own channel metadata, expiration, and `syncToken`.

Expired or invalid sync tokens cause a full calendar resync for that calendar.

### Microsoft Mail

Microsoft mail uses Graph change notifications for messages and Graph delta
query for folder-level reconciliation. Delta links are stored per provider
account and folder.

### Microsoft Calendar

Microsoft calendar uses Graph change notifications for events and Graph delta
query for calendar-view windows. Delta links are stored per calendar/window.

### Shared Worker Rules

- Every webhook only validates, deduplicates, records receipt, and enqueues
  work.
- Workers renew subscriptions before expiry.
- Workers reconcile after missed notifications, rate limits, webhook failures,
  provider lifecycle events, or expired leases.
- Provider 429 and transient 5xx responses move jobs into bounded exponential
  backoff.
- Repeated failures become dead-lettered with user-visible provider health.

## Security Pipeline

Every provider item is untrusted until processed:

1. Normalize provider metadata and source references.
2. Sanitize HTML content before any model or classifier path.
3. Strip hidden text and suspicious invisible/control characters.
4. Run `InstructionFirewall`.
5. Extract typed facts into quarantine.
6. Validate deterministic fields such as sender, recipients, dates, event
   attendees, and external-address status.
7. Write allowed records to OneBrain with provenance and classification.
8. Enqueue later triage/brief jobs only from sanitized OneBrain-backed records.

No email or calendar content can directly create a draft, recipient, attendee,
label, event, export, tool call, or provider write in Phase 3.

## API Surface

Add provider-focused API routes:

- `GET /v1/providers`
- `GET /v1/providers/accounts`
- `POST /v1/providers/oauth/{provider}/start`
- `GET /v1/providers/oauth/{provider}/callback`
- `POST /v1/providers/accounts/{account_id}/disconnect`
- `POST /v1/providers/accounts/{account_id}/sync`
- `GET /v1/providers/accounts/{account_id}/health`
- `POST /v1/providers/webhooks/google`
- `POST /v1/providers/webhooks/microsoft`

OAuth start returns an authorization URL and an opaque connection attempt ID.
The callback returns a safe web redirect or structured JSON for tests.

Webhook routes never return provider secrets, raw content, or sync results.

## UI Surface

Add a provider connection/status section to the existing assistant web shell.

The first UI slice should show:

- Connected accounts grouped by Google and Microsoft.
- Account email or display label when available.
- Mail/calendar capability badges.
- Granted scope tier and missing upgrade tier.
- Last sync status.
- Provider health and degraded states.
- Disconnect/reconnect controls.
- Manual sync request.
- Clear copy that write/send/calendar-write features are unavailable until the
  approval system and scope upgrades are active.

The UI should remain work-focused and dense, not a marketing or setup landing
page.

## Error Handling

- Missing provider client ID/secret: show provider as not configured.
- OAuth state expired or mismatched: reject callback and mark the connection
  attempt failed.
- Provider denies consent: record cancelled connection without storing secrets.
- Refresh token missing on reconnect: prompt full reconnect.
- Token refresh failure: mark account degraded and require reconnect.
- Provider webhook validation challenge: return the provider-required challenge
  response without side effects.
- Duplicate webhook event: return success after dedupe.
- Cursor expired: enqueue full reconciliation.
- OneBrain unavailable: continue operational receipt/retry where safe, but block
  durable capture and high-risk action execution until audit/provenance returns.

## Testing

Add focused backend tests for:

- OAuth state creation, expiry, and mismatch rejection.
- OAuth callback token storage through `SecretProvider`.
- Raw token redaction in API responses, logs, and OneBrain-shaped metadata.
- Connected account create/update/disconnect.
- Scope tier detection and feature-gating metadata.
- Provider webhook challenge handling.
- Webhook replay deduplication.
- Gmail history cursor advancement.
- Google Calendar sync-token advancement and expired-token reset.
- Microsoft mail delta-link advancement.
- Microsoft calendar delta-link advancement.
- Subscription renewal job scheduling.
- Provider 429 retry/backoff and dead-letter state.
- Security pipeline enforcement before provider content capture.

Add web tests/type checks for:

- Provider account status rendering.
- Not-configured, connected, degraded, and disconnected states.
- Mobile layout fit for provider account rows and scope badges.

## Acceptance Mapping

Phase 3 is complete when:

- Google and Microsoft provider configuration is represented in environment and
  health status.
- Users can start OAuth for Google or Microsoft when credentials are configured.
- OAuth callbacks store tokens through `SecretProvider` and never expose raw
  tokens.
- Connected account status shows granted scopes and provider health.
- Read-only sync jobs can be enqueued and processed through worker boundaries.
- Provider webhook endpoints validate, dedupe, and enqueue reconciliation work.
- Cursors/subscriptions are persisted as operational state.
- OneBrain receives connected-account, scope, provider-health, subscription,
  cursor-reference, and sanitized capture/audit records when available.
- Missing live credentials leave a clear not-configured state instead of
  breaking local development.
- No external send, forward, delete, invite, or calendar write is reachable in
  Phase 3.

## Provider References

- Google Gmail scopes:
  <https://developers.google.com/workspace/gmail/api/auth/scopes>
- Gmail push notifications:
  <https://developers.google.com/workspace/gmail/api/guides/push>
- Google Calendar push notifications:
  <https://developers.google.com/workspace/calendar/api/guides/push>
- Microsoft Graph permissions:
  <https://learn.microsoft.com/en-us/graph/permissions-reference>
- Microsoft Outlook change notifications:
  <https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview>
- Microsoft Graph delta query:
  <https://learn.microsoft.com/en-us/graph/delta-query-overview>
- Microsoft message delta query:
  <https://learn.microsoft.com/en-us/graph/delta-query-messages>
- Microsoft calendar-view delta query:
  <https://learn.microsoft.com/en-us/graph/delta-query-events>
