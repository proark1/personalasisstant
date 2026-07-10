# Operational Migrations

Apply the migrations in filename order to the assistant Postgres database before
running the API or worker against a persistent store.

The schema is intentionally operational:

- action state machine, transitions, leases, retries, and idempotency keys
- transactional outbox rows
- jobs, locks, sync cursors, provider subscriptions, and policy rows
- encrypted secret references
- operational audit correlation
- Telegram binding, delivery, and webhook replay state
- assistant session references (auth enforcement; bearer-token hashes only)
- draft-reply content and exact-approval snapshot hash on actions

Business memory, durable message/event contents, retrieval, retention,
permissions, and audit-of-record belong in OneBrain.
