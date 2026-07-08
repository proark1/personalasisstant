from __future__ import annotations

from fastapi.testclient import TestClient

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings

WEBHOOK_SECRET = "telegram-test-webhook-secret"


def _client() -> TestClient:
    return TestClient(create_app(Settings(TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET)))


def _setup(client: TestClient, token: str = "123456:secret-token-value") -> dict:
    response = client.post("/v1/telegram/setup", json={"bot_token": token})
    assert response.status_code == 201
    return response.json()


def _private_message(update_id: int, chat_id: int, user_id: int, text: str) -> dict:
    return {
        "update_id": update_id,
        "message": {
            "message_id": update_id + 10,
            "chat": {"id": chat_id, "type": "private"},
            "from": {"id": user_id, "is_bot": False},
            "text": text,
        },
    }


def _post_webhook(client: TestClient, payload: dict) -> dict:
    response = client.post(
        "/v1/telegram/webhook",
        json=payload,
        headers={"X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET},
    )
    assert response.status_code == 200
    return response.json()


def test_telegram_setup_stores_bot_token_without_returning_raw_value() -> None:
    raw_token = "123456:secret-token-value"
    app = create_app(Settings(TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET))
    client = TestClient(app)

    body = _setup(client, raw_token)

    assert raw_token not in str(body)
    assert body["bot_secret_ref"].startswith("secret://assistant/telegram-bot-token/")
    assert body["binding_command"].startswith("/start ")

    envelope = app.state.container.secrets.envelope(body["bot_secret_ref"])
    assert raw_token not in envelope.ciphertext
    assert app.state.container.secrets.retrieve_secret(body["bot_secret_ref"]) == raw_token


def test_telegram_webhook_rejects_missing_or_invalid_secret() -> None:
    client = _client()
    payload = _private_message(100, 111, 222, "/status")

    missing = client.post("/v1/telegram/webhook", json=payload)
    invalid = client.post(
        "/v1/telegram/webhook",
        json=payload,
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401


def test_start_command_verifies_private_chat_binding() -> None:
    client = _client()
    setup = _setup(client)

    body = _post_webhook(
        client,
        _private_message(101, 111, 222, setup["binding_command"]),
    )
    status = client.get(f"/v1/telegram/bindings/{setup['binding_id']}").json()

    assert body["status"] == "bound"
    assert body["command"] == "/start"
    assert body["binding_id"] == setup["binding_id"]
    assert body["event_ref"].startswith("onebrain://telegram-event/")
    assert status["status"] == "verified"
    assert status["paused"] is False


def test_start_command_is_idempotent_for_duplicate_update_and_same_chat() -> None:
    app = create_app(Settings(TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET))
    client = TestClient(app)
    setup = _setup(client)
    payload = _private_message(102, 111, 222, setup["binding_command"])

    first = _post_webhook(client, payload)
    duplicate_update = _post_webhook(client, payload)
    same_chat_new_update = _post_webhook(
        client,
        _private_message(103, 111, 222, setup["binding_command"]),
    )

    assert first["status"] == "bound"
    assert duplicate_update["status"] == "duplicate"
    assert same_chat_new_update["status"] == "bound"
    assert same_chat_new_update["detail"] == "Telegram chat already verified."
    assert len(app.state.container.telegram.events) == 1


def test_expired_binding_code_is_rejected() -> None:
    client = _client()
    setup = client.post(
        "/v1/telegram/setup",
        json={"bot_token": "123456:secret-token-value", "expires_in_seconds": 0},
    ).json()

    body = _post_webhook(
        client,
        _private_message(104, 111, 222, setup["binding_command"]),
    )
    status = client.get(f"/v1/telegram/bindings/{setup['binding_id']}").json()

    assert body["status"] == "rejected"
    assert "expired" in body["detail"]
    assert status["status"] == "expired"


def test_consumed_binding_code_cannot_bind_another_chat() -> None:
    client = _client()
    setup = _setup(client)

    _post_webhook(client, _private_message(105, 111, 222, setup["binding_command"]))
    replay = _post_webhook(client, _private_message(106, 333, 444, setup["binding_command"]))

    assert replay["status"] == "rejected"
    assert "already used" in replay["detail"]


def test_pause_resume_and_status_commands_are_deterministic() -> None:
    client = _client()
    setup = _setup(client)
    _post_webhook(client, _private_message(107, 111, 222, setup["binding_command"]))

    paused = _post_webhook(client, _private_message(108, 111, 222, "/pause"))
    status_after_pause = _post_webhook(client, _private_message(109, 111, 222, "/status"))
    resumed = _post_webhook(client, _private_message(110, 111, 222, "/resume"))
    status_after_resume = client.get(f"/v1/telegram/bindings/{setup['binding_id']}").json()

    assert paused["status"] == "paused"
    assert status_after_pause["detail"] == "Telegram binding status is paused."
    assert resumed["status"] == "resumed"
    assert status_after_resume["status"] == "verified"
    assert status_after_resume["paused"] is False


def test_unknown_text_is_recorded_as_untrusted_without_creating_action() -> None:
    app = create_app(Settings(TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET))
    client = TestClient(app)
    setup = _setup(client)
    _post_webhook(client, _private_message(111, 111, 222, setup["binding_command"]))

    body = _post_webhook(client, _private_message(112, 111, 222, "hello assistant"))

    assert body["status"] == "received"
    assert body["command"] == "unknown_text"
    assert body["event_ref"].startswith("onebrain://telegram-event/")
    assert app.state.container.actions.all() == []
    assert all(
        "hello assistant" not in event.sanitized_summary
        for event in app.state.container.telegram.events
    )
