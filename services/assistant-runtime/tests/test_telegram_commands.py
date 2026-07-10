from __future__ import annotations

from conftest import authed_client

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings

WEBHOOK_SECRET = "telegram-command-secret"


def _settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        ONEBRAIN_CLIENT_MODE="memory",
        ONEBRAIN_AVAILABLE=True,
        TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET,
        **overrides,
    )


def _app_with_verified_binding():
    app = create_app(_settings())
    client = authed_client(app)
    setup = client.post(
        "/v1/telegram/setup", json={"bot_token": "123456:command-secret-token"}
    ).json()
    _webhook(client, 100, 111, 222, setup["binding_command"])
    return app, client


def _webhook(client, update_id: int, chat_id: int, user_id: int, text: str) -> dict:
    response = client.post(
        "/v1/telegram/webhook",
        json={
            "update_id": update_id,
            "message": {
                "message_id": update_id + 10,
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": user_id, "is_bot": False},
                "text": text,
            },
        },
        headers={"X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET},
    )
    assert response.status_code == 200
    return response.json()


def _last_reply(app) -> str:
    rows = [r for r in app.state.container.outbox.all() if r.effect_type == "telegram.message.send"]
    assert rows, "expected a queued Telegram reply"
    delivery = app.state.container.telegram.bindings.get_delivery(rows[-1].payload_ref)
    assert delivery is not None
    return delivery.message


def test_brief_command_answers_from_workday_snapshot() -> None:
    app, client = _app_with_verified_binding()

    body = _webhook(client, 101, 111, 222, "/brief")

    assert body["status"] == "command"
    assert body["command"] == "/brief"
    reply = _last_reply(app)
    assert "Morning brief" in reply
    assert "Waiting on you:" in reply


def test_today_command_answers_with_priorities() -> None:
    app, client = _app_with_verified_binding()

    _webhook(client, 102, 111, 222, "/today")

    reply = _last_reply(app)
    assert "Morning brief" in reply or "priorities" in reply.lower()


def test_followups_command_answers_with_waiting_items() -> None:
    app, client = _app_with_verified_binding()

    body = _webhook(client, 103, 111, 222, "/followups")

    assert body["command"] == "/followups"
    reply = _last_reply(app)
    assert "Follow-ups" in reply


def test_follow_ups_hyphenated_alias_is_normalized() -> None:
    app, client = _app_with_verified_binding()

    body = _webhook(client, 104, 111, 222, "/follow-ups")

    assert body["command"] == "/followups"
    assert "Follow-ups" in _last_reply(app)


def test_help_command_lists_commands_without_snapshot() -> None:
    app, client = _app_with_verified_binding()

    _webhook(client, 105, 111, 222, "/help")

    reply = _last_reply(app)
    assert "/brief" in reply
    assert "/followups" in reply


def test_free_form_text_gets_safe_pointer_and_no_action() -> None:
    app, client = _app_with_verified_binding()

    body = _webhook(client, 106, 111, 222, "what does my day look like?")

    # Recorded as untrusted, no action created, and answered with the command pointer.
    assert body["command"] == "unknown_text"
    assert app.state.container.actions.all() == []
    reply = _last_reply(app)
    assert "/brief" in reply
    assert "what does my day look like" not in reply


def test_command_from_unbound_chat_is_rejected_without_reply() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    body = _webhook(client, 107, 999, 888, "/brief")

    assert body["status"] == "rejected"
    rows = [r for r in app.state.container.outbox.all() if r.effect_type == "telegram.message.send"]
    assert rows == []


def test_command_answer_is_idempotent_on_duplicate_update() -> None:
    app, client = _app_with_verified_binding()

    _webhook(client, 108, 111, 222, "/brief")
    _webhook(client, 108, 111, 222, "/brief")  # same update_id -> duplicate

    rows = [r for r in app.state.container.outbox.all() if r.effect_type == "telegram.message.send"]
    assert len(rows) == 1
