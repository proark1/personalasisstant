# Data Ownership Matrix

Source: `docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`.

The assistant must not become a second OneBrain. If it is needed to execute,
retry, lock, or recover the product, it lives in assistant Postgres. If it is
business memory, user knowledge, permissioned content, provenance, privacy, or
audit-of-record, it lives in OneBrain.

| Entity | Assistant Postgres Owns | OneBrain Owns |
|---|---|---|
| User/account/space identity | Local cached IDs only when needed for job execution | Source of truth for user, account, space, permissions, and purpose scope |
| OAuth refresh tokens and Telegram bot tokens | Encrypted values or secret references, rotation state, revocation state | Secret references, granted scopes, ownership, purpose, and audit metadata |
| Provider account metadata | Operational provider account IDs, cached display labels needed for job/UI recovery, webhook/subscription state, sync health, reconnect/disconnect state | Durable connected-account facts, user-visible provenance, scope grants, provider account history |
| Sync cursors, history IDs, delta tokens | Operational cursor values, lease state, retry/reconciliation state | Cursor references, reconciliation summaries, provider-health facts |
| Email/calendar content | Short-lived processing cache where needed, never a memory source of truth | Durable captured messages/events, summaries, extracted facts, provenance, permissions, retention |
| Telegram inbound/outbound messages | Delivery state, callback state, retries, deduplication | Durable channel provenance, conversation memory, notification facts |
| Action state | State machine, leases, retries, outbox rows, idempotency keys | Action proposal, approval fact, source references, final execution fact, policy decision, audit-of-record |
| Provider health | Operational retry/debug state | User-visible degradation facts and audit-relevant provider events |
| Feedback | Pending processing state | Durable assistant feedback, correction, and learning signal |
