# Phase 0 Foundation Rules

Source: `docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`.

## Architecture

- Use the OneBrain hybrid pattern: Next.js web shell, FastAPI backend, and a
  Python worker sharing the same backend package.
- Railway is only a deployment target. Docker images must run outside Railway.
- The API is thin: authenticate, receive webhooks, serve UI state, record
  approvals, and enqueue work.
- Workers perform sync, triage, briefs, security screening, proposals,
  Telegram delivery, renewal, reconciliation, outbox relay, and approved action
  execution.
- No LLM call or external provider write is required to complete an ordinary
  HTTP request.

## Safety

- Treat email bodies, calendar descriptions, attachments, Telegram messages,
  web content, and tool output as untrusted data.
- Do not let untrusted content become tool names, arguments, recipients,
  attendees, labels, or policies.
- Every external side effect goes through the transactional outbox.
- High-risk actions require web approval or fresh-auth confirmation by default.
- If OneBrain audit/provenance is unavailable, high-risk external actions are
  blocked.

## Secrets

- Raw OAuth refresh tokens, Telegram bot tokens, webhook secrets, provider API
  keys, cookies, and authorization headers must not be logged.
- Durable records store encrypted values or secret references, never raw
  secret values.
- Secret records track version, created time, last-used time, rotation time,
  and revocation time.

## UI

- Main screens and large panels stay light.
- The product is dense, calm, and work-focused.
- Mobile workflows are first-class.
- Approval cards show risk tier, affected account, recipients or attendees,
  source reference, changed fields, sensitive-content flags, approval reason,
  and reversibility.
