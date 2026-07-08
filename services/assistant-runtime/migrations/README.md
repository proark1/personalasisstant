# Operational Migrations

Apply `0001_operational_foundation.sql` to the assistant Postgres database before
running the API or worker against a persistent store.

The schema is intentionally operational:

- action state machine, transitions, leases, retries, and idempotency keys
- transactional outbox rows
- jobs, locks, sync cursors, provider subscriptions, and policy rows
- encrypted secret references
- operational audit correlation

Business memory, durable message/event contents, retrieval, retention,
permissions, and audit-of-record belong in OneBrain.
