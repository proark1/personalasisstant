from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import UUID

from conftest import authed_client
from fastapi.testclient import TestClient

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.schemas import OutboxState
from assistant_runtime.worker.runner import AssistantWorker

WEBHOOK_SECRET = "telegram-test-webhook-secret"


@dataclass
class RecordingTelegramTransport:
    sent: list[tuple[str, str, str]] = field(default_factory=list)

    async def send_message(self, bot_token: str, chat_id: str, message: str) -> str:
        self.sent.append((bot_token, chat_id, message))
        return f"telegram://message/{chat_id}/{len(self.sent)}"


class LeakyFailingTelegramTransport:
    async def send_message(self, bot_token: str, chat_id: str, message: str) -> str:
        raise RuntimeError(f"failed with token={bot_token} chat={chat_id} message={message}")


def _settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        ONEBRAIN_CLIENT_MODE="memory",
        ONEBRAIN_AVAILABLE=True,
        TELEGRAM_WEBHOOK_SECRET=WEBHOOK_SECRET,
        **overrides,
    )


def _client() -> TestClient:
    return authed_client(create_app(_settings()))


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
    app = create_app(_settings())
    client = authed_client(app)

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
    app = create_app(_settings())
    client = authed_client(app)
    setup = _setup(client)

    body = _post_webhook(
        client,
        _private_message(101, 111, 222, setup["binding_command"]),
    )
    status = client.get(f"/v1/telegram/bindings/{setup['binding_id']}").json()
    records = list(app.state.container.brain.records.values())

    assert body["status"] == "bound"
    assert body["command"] == "/start"
    assert body["binding_id"] == setup["binding_id"]
    assert body["event_ref"].startswith("onebrain://telegram-event/")
    assert status["status"] == "verified"
    assert status["paused"] is False
    assert any(record["record_type"] == "telegram_binding" for record in records)
    assert records[-1]["metadata"]["event_type"] == "telegram.binding.verified"


def test_start_command_is_idempotent_for_duplicate_update_and_same_chat() -> None:
    app = create_app(_settings())
    client = authed_client(app)
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
    app = create_app(_settings())
    client = authed_client(app)
    setup = _setup(client)
    _post_webhook(client, _private_message(111, 111, 222, setup["binding_command"]))

    body = _post_webhook(client, _private_message(112, 111, 222, "hello assistant"))
    records = list(app.state.container.brain.records.values())

    assert body["status"] == "received"
    assert body["command"] == "unknown_text"
    assert body["event_ref"].startswith("onebrain://telegram-event/")
    assert app.state.container.actions.all() == []
    assert all(
        "hello assistant" not in event.sanitized_summary
        for event in app.state.container.telegram.events
    )
    assert records[-1]["record_type"] == "message"
    assert records[-1]["metadata"]["content_trust"] == "untrusted"
    assert "hello assistant" not in records[-1]["content"]


def test_test_message_requires_verified_unpaused_binding() -> None:
    client = _client()
    setup = _setup(client)

    unverified = client.post(f"/v1/telegram/bindings/{setup['binding_id']}/test-message", json={})
    _post_webhook(client, _private_message(113, 111, 222, setup["binding_command"]))
    _post_webhook(client, _private_message(114, 111, 222, "/pause"))
    paused = client.post(f"/v1/telegram/bindings/{setup['binding_id']}/test-message", json={})

    assert unverified.status_code == 409
    assert paused.status_code == 409


def test_verified_binding_queues_test_message_without_sending_inline() -> None:
    app = create_app(_settings())
    transport = RecordingTelegramTransport()
    app.state.container.telegram.transport = transport
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(115, 111, 222, setup["binding_command"]))

    response = client.post(f"/v1/telegram/bindings/{setup['binding_id']}/test-message", json={})
    body = response.json()
    rows = app.state.container.outbox.all()
    records = list(app.state.container.brain.records.values())

    assert response.status_code == 202
    assert body["status"] == "queued"
    assert body["delivery_ref"].startswith("onebrain://telegram-delivery/")
    assert "delivery-secret-token" not in str(body)
    assert "111" not in str(body)
    assert len(rows) == 1
    assert rows[0].effect_type == "telegram.message.send"
    assert OutboxState(rows[0].state) == OutboxState.pending
    assert transport.sent == []
    assert records[-1]["record_type"] == "notification_event"
    assert records[-1]["metadata"]["event_type"] == "telegram.test_message.queued"


def test_relay_sends_queued_test_message_and_marks_outbox_delivered() -> None:
    app = create_app(_settings())
    transport = RecordingTelegramTransport()
    app.state.container.telegram.transport = transport
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(116, 111, 222, setup["binding_command"]))
    client.post(
        f"/v1/telegram/bindings/{setup['binding_id']}/test-message",
        json={"message": "Setup test message"},
    )

    processed = asyncio.run(
        app.state.container.telegram.relay_next_delivery(app.state.container.outbox, "worker-1")
    )
    row = app.state.container.outbox.all()[0]

    assert processed == 1
    assert transport.sent == [("123456:delivery-secret-token", "111", "Setup test message")]
    assert OutboxState(row.state) == OutboxState.delivered
    assert row.payload_ref.startswith("telegram://message/111/")


def test_relay_retries_when_secret_lookup_fails() -> None:
    app = create_app(_settings())
    app.state.container.telegram.transport = RecordingTelegramTransport()
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(117, 111, 222, setup["binding_command"]))
    binding = app.state.container.telegram.bindings.get(UUID(setup["binding_id"]))
    assert binding is not None
    app.state.container.secrets.revoke_secret(binding.bot_secret_ref)
    client.post(f"/v1/telegram/bindings/{setup['binding_id']}/test-message", json={})

    processed = asyncio.run(
        app.state.container.telegram.relay_next_delivery(app.state.container.outbox, "worker-1")
    )
    row = app.state.container.outbox.all()[0]

    assert processed == 0
    assert OutboxState(row.state) == OutboxState.retry_wait
    assert row.last_error is not None


def test_relay_redacts_transport_error_details() -> None:
    app = create_app(_settings())
    app.state.container.telegram.transport = LeakyFailingTelegramTransport()
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(118, 111, 222, setup["binding_command"]))
    client.post(
        f"/v1/telegram/bindings/{setup['binding_id']}/test-message",
        json={"message": "Setup test message"},
    )

    processed = asyncio.run(
        app.state.container.telegram.relay_next_delivery(app.state.container.outbox, "worker-1")
    )
    row = app.state.container.outbox.all()[0]

    assert processed == 0
    assert OutboxState(row.state) == OutboxState.retry_wait
    assert row.last_error == "RuntimeError"
    assert "delivery-secret-token" not in row.last_error
    assert "111" not in row.last_error


def test_worker_relay_sends_queued_test_message_and_marks_outbox_delivered() -> None:
    app = create_app(_settings())
    transport = RecordingTelegramTransport()
    app.state.container.telegram.transport = transport
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(119, 111, 222, setup["binding_command"]))
    client.post(
        f"/v1/telegram/bindings/{setup['binding_id']}/test-message",
        json={"message": "Worker setup test message"},
    )
    worker = AssistantWorker(
        worker_id="worker-telegram-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=InMemoryQueueProvider(),
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        brain=app.state.container.brain,
    )

    result = worker.run_once()
    row = app.state.container.outbox.all()[0]
    records = list(app.state.container.brain.records.values())

    assert result.outbox_processed == 1
    assert transport.sent == [
        ("123456:delivery-secret-token", "111", "Worker setup test message")
    ]
    assert OutboxState(row.state) == OutboxState.delivered
    assert row.payload_ref.startswith("telegram://message/111/")
    assert records[-1]["record_type"] == "notification_event"
    assert records[-1]["metadata"]["event_type"] == "telegram.message.delivered"


def test_worker_relay_redacts_telegram_transport_error_details() -> None:
    app = create_app(_settings())
    app.state.container.telegram.transport = LeakyFailingTelegramTransport()
    client = authed_client(app)
    setup = _setup(client, token="123456:delivery-secret-token")
    _post_webhook(client, _private_message(120, 111, 222, setup["binding_command"]))
    client.post(
        f"/v1/telegram/bindings/{setup['binding_id']}/test-message",
        json={"message": "Worker setup test message"},
    )
    worker = AssistantWorker(
        worker_id="worker-telegram-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=InMemoryQueueProvider(),
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
    )

    result = worker.run_once()
    row = app.state.container.outbox.all()[0]

    assert result.outbox_processed == 0
    assert OutboxState(row.state) == OutboxState.retry_wait
    assert row.last_error == "RuntimeError"
    assert "delivery-secret-token" not in row.last_error
    assert "111" not in row.last_error
