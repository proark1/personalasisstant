# Telegram webhook setup

The bot receives messages via a **Telegram webhook** — Telegram POSTs each
update straight to the `telegram-poll` edge function, which replies instantly.
No polling, and no per-minute scheduler for replies.

`telegram-poll` runs in two modes from the same code:

- **Webhook** (production): the request body is a single Telegram `Update`
  (`{"update_id":...,"message":{...}}`). It processes that one update and returns.
- **Polling** (fallback/dev): the request body is `{}` (or empty). It runs the
  long-poll `getUpdates` loop. This is what the old per-minute cron used.

> Registering a webhook **disables `getUpdates`** on Telegram's side, so you run
> one or the other — not both. Once the webhook is set, remove/disable any
> `telegram-poll` cron job (already removed from `cron/scheduler.mjs`).

## One-time registration

Pick a strong secret and set it on the **edge-runtime** service as
`TELEGRAM_WEBHOOK_SECRET` (so the function can verify incoming calls), then tell
Telegram to use the same secret:

```sh
SECRET="$(openssl rand -hex 32)"     # also set as TELEGRAM_WEBHOOK_SECRET on edge-runtime
GATEWAY="https://<your-gateway>.up.railway.app"   # public gateway (Telegram must reach it)

curl -s "https://api.telegram.org/bot${TELEGRAM_API_KEY}/setWebhook" \
  -d "url=${GATEWAY}/functions/v1/telegram-poll" \
  -d "secret_token=${SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query"]'
```

The webhook URL must be the **public gateway** (Telegram calls it from the
internet), not the internal `railway.internal` address.

## Verify

```sh
curl -s "https://api.telegram.org/bot${TELEGRAM_API_KEY}/getWebhookInfo"
```

Look for your `url`, `pending_update_count: 0`, and an empty `last_error_message`.
Then message the bot — a reply should arrive within a second or two. The
function logs `mode: "webhook"` in its JSON response and per-update lines like
`[telegram-poll] chat=… text="…"`.

If `TELEGRAM_WEBHOOK_SECRET` is set but Telegram's `secret_token` doesn't match,
the function returns `401` and the bot goes silent — re-run `setWebhook` with the
matching secret.

## Reverting to polling

```sh
curl -s "https://api.telegram.org/bot${TELEGRAM_API_KEY}/deleteWebhook"
```

Then re-add a `telegram-poll` job to `cron/scheduler.mjs` (every minute) to
resume the long-poll fallback.
