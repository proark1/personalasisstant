# Telegram Binding Foundation Design

Date: 2026-07-08

## Context

This design covers the first implementation slice of Phase 2 from the OneBrain
Assistant implementation plan: Telegram bot setup and private chat binding.

Phase 2 eventually includes Telegram delivery, morning briefs, important
updates, safe approval callbacks, inbound assistant questions, notification
preferences, quiet hours, sensitive-content defaults, and callback deduplication.
This slice deliberately builds the binding foundation first because every later
Telegram capability needs a verified private chat, a protected bot token, and
auditable provenance.

## Goal

Let a user connect their own Telegram bot, prove control of a private Telegram
chat, and route inbound Telegram updates through the assistant without treating
Telegram content as trusted instructions.

The first slice must establish:

- Bot token storage through `SecretProvider`, never raw token persistence in
  OneBrain or logs.
- A Telegram webhook endpoint with webhook-secret verification.
- A binding code flow using `/start <binding_code>`.
- Deterministic inbound command routing for setup commands.
- Telegram binding and inbound event records shaped for OneBrain provenance and
  audit metadata.
- A `TelegramChannel` implementation that remains behind the existing
  `NotificationChannel` boundary.

## Non-Goals

This slice does not implement morning brief delivery, important update delivery,
real external action approval, BotFather tutorial UI polish, full notification
preferences, or quiet-hour scheduling. It can expose contracts and basic setup
state that later UI work will consume, but it must not ship irreversible
Telegram approval execution.

## Architecture

The assistant API stays thin. Telegram webhook requests are parsed, validated,
recorded as operational events, and routed to deterministic handlers. No LLM
call, external send, or provider write is required to complete the webhook
request.

The `TelegramChannel` becomes the concrete first `NotificationChannel`.
It owns Telegram-specific parsing, binding validation, message rendering for
setup responses, and callback payload parsing. Shared action execution remains
outside the channel in `ActionStore`, `ActionPolicyEngine`, and the outbox.

Operational state stays in assistant storage because it is needed to connect,
retry, deduplicate, and erase Telegram operations safely. Durable business data,
memory, permissioned content, and audit-of-record stay in OneBrain.

## Components

### Telegram Setup API

The API exposes setup-oriented endpoints for the web settings/onboarding flow:

- Store or rotate a bot token by passing it directly into `SecretProvider`.
- Create a short-lived binding code scoped to account, user, and space.
- Return only secret references, masked token metadata, setup status, and
  instructions for the user to open Telegram and send `/start <binding_code>`.
- Send a safe test message after binding is verified.

The setup API never returns the raw token after submission.

### Telegram Webhook

The webhook endpoint verifies the configured Telegram webhook secret before
processing the update. Invalid or missing secrets return an authorization error
without parsing business content.

Accepted update types for this slice:

- `/start <binding_code>` in a private chat.
- `/pause`, `/resume`, and `/status` as deterministic setup commands.
- Unknown text, which is recorded as an inbound Telegram message but routed to a
  safe "not ready yet" response until assistant question handling is added.

Group chats, forwarded messages, channel posts, and unrecognized callback data
are rejected or ignored for this slice.

### Binding Store

The binding model is migration-ready and includes:

- `binding_id`
- `account_id`
- `user_id`
- `space_id`
- `telegram_chat_id_hash`
- `telegram_user_id_hash`
- `telegram_chat_secret_ref`
- `bot_secret_ref`
- `binding_code_hash`
- `status`
- `verified_at`
- `created_at`
- `updated_at`
- `revoked_at`
- `last_update_id`
- `correlation_id`
- `audit_correlation_id`

Raw Telegram chat IDs and user IDs are not written to OneBrain. The chat address
needed for outbound Telegram calls is stored as encrypted operational state or a
secret reference such as `telegram_chat_secret_ref`. OneBrain receives
references and hashed identifiers, not raw bot tokens or raw Telegram chat IDs.

### OneBrain Provenance

For each accepted binding or inbound event, the assistant prepares a OneBrain
event payload with:

- account, user, space, and purpose
- Telegram binding reference
- event type
- source update reference
- sanitized command or short message summary
- provider metadata without raw secrets
- correlation and audit correlation IDs
- retention and classification hints

If OneBrain is unavailable, the webhook still records operational state and
queues a retryable provenance job. High-risk or irreversible actions remain
blocked while OneBrain is degraded.

### Command Router

Inbound Telegram messages go through a deterministic router before any assistant
reasoning is allowed.

Initial commands:

- `/start <binding_code>` verifies a pending binding code and marks the chat as
  verified.
- `/status` reports setup status without exposing private data.
- `/pause` pauses Telegram notifications for the binding.
- `/resume` resumes Telegram notifications for the binding.

All command handlers are idempotent. Replaying the same Telegram update ID or
the same `/start` command must not create duplicate bindings.

## Data Flow

1. User creates a bot in BotFather and pastes the token into web settings.
2. Assistant stores the token through `SecretProvider` and keeps only the
   returned secret reference in operational state.
3. Assistant creates a short-lived binding code for account, user, and space.
4. User opens Telegram and sends `/start <binding_code>` to their bot.
5. Telegram calls the webhook with the configured webhook secret.
6. API verifies the webhook secret and passes the update to `TelegramChannel`.
7. `TelegramChannel` parses the update and routes it to the binding command.
8. Binding store validates the hashed code, marks the binding verified, and
   records the Telegram chat/user hashes.
9. Assistant prepares a OneBrain provenance event for the binding.
10. Web settings can now show Telegram as connected and eligible for future
    private notifications.

## Security Rules

- Telegram content is untrusted data, not instructions.
- Bot tokens are stored only through `SecretProvider`.
- Binding codes are short-lived, single-purpose, and stored hashed.
- Webhook secret verification runs before command parsing.
- Only private chats can bind in this slice.
- Unknown commands cannot create actions or tool calls.
- Sensitive content defaults to short summaries and prompts in later delivery
  work.
- Callback approval execution is excluded until binding, policy eligibility, and
  action deduplication are implemented together.

## Error Handling

- Invalid webhook secret: return unauthorized and record a redacted metric.
- Expired or unknown binding code: return a safe setup failure response.
- Duplicate `/start`: return the existing verified binding status.
- Different Telegram chat reusing a consumed code: reject and require a new code.
- OneBrain unavailable: keep operational record, enqueue provenance retry, and
  mark provider health as degraded.
- Secret retrieval failure: mark Telegram setup degraded and avoid any outbound
  Telegram call.

## Testing

Add focused backend tests for:

- Bot token storage never exposes raw token in API responses or OneBrain-shaped
  event payloads.
- Webhook secret rejection.
- Successful `/start <binding_code>` verification from a private chat.
- Duplicate `/start` idempotency.
- Expired binding code rejection.
- Consumed binding code replay from another chat rejection.
- `/pause`, `/resume`, and `/status` deterministic command routing.
- Unknown text is recorded as inbound untrusted content and does not create an
  action or tool call.

## Acceptance Mapping

This slice directly supports:

- User can connect their own Telegram bot created through BotFather.
- Telegram events are written to OneBrain with provenance and audit metadata.
- User can pause/resume Telegram updates from Telegram at the command-routing
  level.

It prepares but does not complete:

- Morning brief delivery.
- Replying with a simple assistant question.
- Approving or dismissing safe test action proposals.
- Callback deduplication against `ActionStore`.

Those later items should build on the verified binding and command router from
this slice.
