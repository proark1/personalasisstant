# Phase 3 Completion Notes

Date: 2026-07-09

This repo is ready to treat Phase 3 as complete for provider-ready local
development and credential-pending live OAuth testing.

## Implemented

- Google and Microsoft OAuth configuration, start routes, callback routes, and
  provider status reporting.
- Read-only scope tiers for Gmail, Google Calendar, Microsoft mail, and
  Microsoft Calendar.
- Future write/send/calendar-write scopes represented as upgrade metadata only;
  no external send, forward, delete, invite, or calendar write is reachable in
  Phase 3.
- Encrypted token payload storage through `SecretProvider`; raw tokens are not
  returned to the browser or written to OneBrain records.
- Operational connected-provider-account state with granted scopes, provider
  account references, sync state, and provider health.
- Operational OAuth attempt, sync cursor, provider subscription, and webhook
  replay-dedupe storage.
- Provider webhook endpoints for Google and Microsoft that dedupe and enqueue
  reconciliation work instead of syncing inline.
- Worker processing for provider initial sync, manual/reconciliation sync, and
  subscription setup jobs.
- OneBrain record writes for provider account, scope grant, provider health,
  sync cursor, and sync subscription events when OneBrain is available.
- Initial sync and subscription jobs are queued only after OneBrain accepts the
  connected-account provenance. If OneBrain is unavailable, the token is stored
  operationally, the provider account is marked degraded, and sync stays paused.
- Web connection panel showing provider configuration, connected accounts,
  read-scope status, manual sync, and disconnect controls.

## Pending External Setup

- Create Google Cloud OAuth credentials and add `GOOGLE_OAUTH_CLIENT_ID` and
  `GOOGLE_OAUTH_CLIENT_SECRET`.
- Configure the Google callback URL:
  `https://assistant-api-production-5210.up.railway.app/v1/providers/oauth/google/callback`
- Create Google Pub/Sub and Gmail watch setup before live push sync.
- Create a Microsoft Entra app registration and add
  `MICROSOFT_OAUTH_CLIENT_ID` and `MICROSOFT_OAUTH_CLIENT_SECRET`.
- Configure the Microsoft callback URL:
  `https://assistant-api-production-5210.up.railway.app/v1/providers/oauth/microsoft/callback`
- Configure Microsoft Graph change-notification webhook subscriptions before
  live push sync.

## Next Gate

Before Phase 4 starts, run at least one live Google or Microsoft read-only OAuth
connection against production Railway, process the initial worker sync job, and
confirm OneBrain receives provider account, scope grant, sync cursor,
subscription, and provider health records.
