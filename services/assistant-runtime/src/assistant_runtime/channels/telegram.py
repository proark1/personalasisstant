from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta
from threading import RLock
from typing import Protocol
from uuid import UUID, uuid4

import httpx

from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.interfaces import SecretProvider
from assistant_runtime.schemas import (
    OutboxRow,
    OutboxState,
    ScopedIdentity,
    TelegramBindingRecord,
    TelegramBindingStatus,
    TelegramBindingStatusResponse,
    TelegramDeliveryRecord,
    TelegramProvenanceEvent,
    TelegramSetupRequest,
    TelegramSetupResponse,
    TelegramTestMessageRequest,
    TelegramTestMessageResponse,
    TelegramWebhookResponse,
    utc_now,
)


class TelegramBindingNotFound(KeyError):
    pass


class TelegramBindingNotReady(ValueError):
    pass


class TelegramDeliveryNotFound(KeyError):
    pass


class TelegramDeliveryError(RuntimeError):
    pass


class TelegramTransport(Protocol):
    async def send_message(self, bot_token: str, chat_id: str, message: str) -> str: ...


class TelegramBotApiTransport:
    async def send_message(self, bot_token: str, chat_id: str, message: str) -> str:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(url, json={"chat_id": chat_id, "text": message})
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise TelegramDeliveryError("Telegram Bot API sendMessage failed.") from exc
        message_id = payload.get("result", {}).get("message_id", "unknown")
        return f"telegram://message/{chat_id}/{message_id}"


class InMemoryTelegramBindingStore:
    """Operational Telegram binding state with migration-ready fields."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._bindings: dict[UUID, TelegramBindingRecord] = {}
        self._code_index: dict[str, UUID] = {}
        self._chat_index: dict[str, UUID] = {}
        self._processed_updates: dict[str, TelegramWebhookResponse] = {}
        self._events: list[TelegramProvenanceEvent] = []
        self._deliveries: dict[str, TelegramDeliveryRecord] = {}

    def create_pending(
        self,
        scope: ScopedIdentity,
        bot_secret_ref: str,
        binding_code_hash: str,
        expires_at,
    ) -> TelegramBindingRecord:
        record = TelegramBindingRecord(
            scope=scope,
            bot_secret_ref=bot_secret_ref,
            binding_code_hash=binding_code_hash,
            binding_code_expires_at=expires_at,
        )
        with self._lock:
            self._bindings[record.binding_id] = record
            self._code_index[binding_code_hash] = record.binding_id
        return record

    def get(self, binding_id: UUID) -> TelegramBindingRecord | None:
        with self._lock:
            return self._bindings.get(binding_id)

    def get_by_code_hash(self, binding_code_hash: str) -> TelegramBindingRecord | None:
        with self._lock:
            binding_id = self._code_index.get(binding_code_hash)
            if binding_id is None:
                return None
            return self._bindings[binding_id]

    def get_by_chat_hash(self, chat_hash: str) -> TelegramBindingRecord | None:
        with self._lock:
            binding_id = self._chat_index.get(chat_hash)
            if binding_id is None:
                return None
            return self._bindings[binding_id]

    def verify_pending(
        self,
        binding_id: UUID,
        chat_hash: str,
        user_hash: str,
        chat_secret_ref: str,
        update_id: str,
    ) -> TelegramBindingRecord:
        with self._lock:
            record = self._bindings[binding_id]
            record.telegram_chat_id_hash = chat_hash
            record.telegram_user_id_hash = user_hash
            record.telegram_chat_secret_ref = chat_secret_ref
            record.status = TelegramBindingStatus.verified
            record.verified_at = utc_now()
            record.updated_at = record.verified_at
            record.last_update_id = update_id
            self._chat_index[chat_hash] = record.binding_id
            return record

    def mark_expired(self, binding_id: UUID) -> TelegramBindingRecord:
        with self._lock:
            record = self._bindings[binding_id]
            record.status = TelegramBindingStatus.expired
            record.updated_at = utc_now()
            return record

    def pause(self, chat_hash: str, update_id: str) -> TelegramBindingRecord:
        with self._lock:
            record = self.get_by_chat_hash(chat_hash)
            if record is None:
                raise TelegramBindingNotFound(chat_hash)
            record.status = TelegramBindingStatus.paused
            record.last_update_id = update_id
            record.updated_at = utc_now()
            return record

    def resume(self, chat_hash: str, update_id: str) -> TelegramBindingRecord:
        with self._lock:
            record = self.get_by_chat_hash(chat_hash)
            if record is None:
                raise TelegramBindingNotFound(chat_hash)
            record.status = TelegramBindingStatus.verified
            record.last_update_id = update_id
            record.updated_at = utc_now()
            return record

    def remember_update(self, update_id: str, result: TelegramWebhookResponse) -> None:
        with self._lock:
            self._processed_updates[update_id] = result

    def get_processed_update(self, update_id: str) -> TelegramWebhookResponse | None:
        with self._lock:
            return self._processed_updates.get(update_id)

    def record_event(
        self,
        binding: TelegramBindingRecord,
        event_type: str,
        update_id: str,
        sanitized_summary: str,
        provider_metadata: dict[str, str] | None = None,
    ) -> TelegramProvenanceEvent:
        event = TelegramProvenanceEvent(
            event_ref=f"onebrain://telegram-event/{uuid4()}",
            binding_id=binding.binding_id,
            event_type=event_type,
            source_update_ref=f"telegram://update/{update_id}",
            sanitized_summary=sanitized_summary,
            scope=binding.scope,
            provider_metadata=provider_metadata or {},
            correlation_id=binding.correlation_id,
            audit_correlation_id=binding.audit_correlation_id,
        )
        with self._lock:
            self._events.append(event)
        return event

    def events(self) -> list[TelegramProvenanceEvent]:
        with self._lock:
            return list(self._events)

    def create_delivery(
        self,
        binding: TelegramBindingRecord,
        message: str,
        idempotency_key: str,
    ) -> TelegramDeliveryRecord:
        with self._lock:
            for delivery in self._deliveries.values():
                if delivery.idempotency_key == idempotency_key:
                    return delivery
            delivery = TelegramDeliveryRecord(
                delivery_ref=f"onebrain://telegram-delivery/{uuid4()}",
                binding_id=binding.binding_id,
                message=message,
                idempotency_key=idempotency_key,
            )
            self._deliveries[delivery.delivery_ref] = delivery
            return delivery

    def get_delivery(self, delivery_ref: str) -> TelegramDeliveryRecord | None:
        with self._lock:
            return self._deliveries.get(delivery_ref)

    def mark_delivery_delivered(
        self, delivery_ref: str, provider_response_ref: str
    ) -> TelegramDeliveryRecord:
        with self._lock:
            delivery = self._deliveries[delivery_ref]
            delivery.state = OutboxState.delivered
            delivery.provider_response_ref = provider_response_ref
            delivery.updated_at = utc_now()
            return delivery


class TelegramChannel:
    """Telegram notification channel with deterministic binding command routing."""

    def __init__(
        self,
        secret_provider: SecretProvider,
        binding_store: InMemoryTelegramBindingStore | None = None,
        transport: TelegramTransport | None = None,
    ) -> None:
        self.secret_provider = secret_provider
        self.bindings = binding_store or InMemoryTelegramBindingStore()
        self.transport = transport or TelegramBotApiTransport()

    async def send(self, user_ref: str, message_ref: str, correlation_id: str) -> str:
        return f"telegram://delivery/{user_ref}/{correlation_id}"

    def create_setup(self, request: TelegramSetupRequest) -> TelegramSetupResponse:
        bot_secret_ref = self.secret_provider.store_secret(request.bot_token, "telegram-bot-token")
        binding_code = secrets.token_urlsafe(12)
        expires_at = utc_now() + timedelta(seconds=request.expires_in_seconds)
        record = self.bindings.create_pending(
            scope=request.scope,
            bot_secret_ref=bot_secret_ref,
            binding_code_hash=_hash_binding_code(binding_code),
            expires_at=expires_at,
        )
        return TelegramSetupResponse(
            binding_id=record.binding_id,
            status=TelegramBindingStatus(record.status),
            bot_secret_ref=record.bot_secret_ref,
            token_preview=_mask_token(request.bot_token),
            binding_code=binding_code,
            binding_command=f"/start {binding_code}",
            expires_at=record.binding_code_expires_at,
            correlation_id=record.correlation_id,
            audit_correlation_id=record.audit_correlation_id,
        )

    def binding_status(self, binding_id: UUID) -> TelegramBindingStatusResponse:
        record = self.bindings.get(binding_id)
        if record is None:
            raise TelegramBindingNotFound(str(binding_id))
        return _status_response(record)

    def queue_test_message(
        self,
        binding_id: UUID,
        request: TelegramTestMessageRequest,
        outbox: InMemoryOutboxStore,
    ) -> TelegramTestMessageResponse:
        record = self.bindings.get(binding_id)
        if record is None:
            raise TelegramBindingNotFound(str(binding_id))

        status = TelegramBindingStatus(record.status)
        if status == TelegramBindingStatus.paused:
            raise TelegramBindingNotReady("Telegram binding is paused.")
        if status != TelegramBindingStatus.verified:
            raise TelegramBindingNotReady("Telegram binding is not verified.")
        if record.telegram_chat_secret_ref is None:
            raise TelegramBindingNotReady("Telegram chat secret reference is missing.")

        idempotency_key = request.idempotency_key or f"telegram-test-message:{binding_id}"
        delivery = self.bindings.create_delivery(record, request.message, idempotency_key)
        row = outbox.create(
            scope=record.scope,
            effect_type="telegram.message.send",
            payload_ref=delivery.delivery_ref,
            idempotency_key=delivery.idempotency_key,
            correlation_id=record.correlation_id,
            audit_correlation_id=record.audit_correlation_id,
        )
        event = self.bindings.record_event(
            record,
            event_type="telegram.test_message.queued",
            update_id=str(row.outbox_id),
            sanitized_summary="Safe Telegram setup test message queued.",
            provider_metadata={"delivery_ref": delivery.delivery_ref},
        )
        return TelegramTestMessageResponse(
            status="queued",
            detail="Telegram test message queued for outbox delivery.",
            binding_id=record.binding_id,
            outbox_id=row.outbox_id,
            delivery_ref=delivery.delivery_ref,
            event_ref=event.event_ref,
            correlation_id=record.correlation_id,
            audit_correlation_id=record.audit_correlation_id,
        )

    async def relay_next_delivery(self, outbox: InMemoryOutboxStore, worker_id: str) -> int:
        row = outbox.lease_next(worker_id)
        if row is None:
            return 0
        if row.effect_type != "telegram.message.send":
            outbox.mark_retry_or_dead_letter(row.outbox_id, "Unsupported Telegram delivery effect.")
            return 0
        try:
            provider_response_ref = await self.deliver_outbox_row(row)
        except Exception as exc:
            outbox.mark_retry_or_dead_letter(row.outbox_id, safe_telegram_delivery_error(exc))
            return 0
        outbox.mark_delivered(row.outbox_id, provider_response_ref=provider_response_ref)
        return 1

    async def deliver_outbox_row(self, row: OutboxRow) -> str:
        delivery = self.bindings.get_delivery(row.payload_ref)
        if delivery is None:
            raise TelegramDeliveryNotFound(row.payload_ref)
        binding = self.bindings.get(delivery.binding_id)
        if binding is None:
            raise TelegramBindingNotFound(str(delivery.binding_id))
        if binding.telegram_chat_secret_ref is None:
            raise TelegramBindingNotReady("Telegram chat secret reference is missing.")

        bot_token = self.secret_provider.retrieve_secret(binding.bot_secret_ref)
        chat_id = self.secret_provider.retrieve_secret(binding.telegram_chat_secret_ref)
        provider_response_ref = await self.transport.send_message(
            bot_token, chat_id, delivery.message
        )
        self.bindings.mark_delivery_delivered(delivery.delivery_ref, provider_response_ref)
        self.bindings.record_event(
            binding,
            event_type="telegram.message.delivered",
            update_id=str(row.outbox_id),
            sanitized_summary="Telegram setup test message delivered.",
            provider_metadata={"provider_response_ref": provider_response_ref},
        )
        return provider_response_ref

    async def receive(self, payload: dict[str, object]) -> TelegramWebhookResponse:
        update_id = str(payload.get("update_id", "unknown"))
        duplicate = self.bindings.get_processed_update(update_id)
        if duplicate is not None:
            result = duplicate.model_copy(
                update={"status": "duplicate", "detail": "Update already processed."}
            )
            return result

        result = self._route_update(payload, update_id)
        self.bindings.remember_update(update_id, result)
        return result

    def _route_update(
        self, payload: dict[str, object], update_id: str
    ) -> TelegramWebhookResponse:
        message = payload.get("message")
        if not isinstance(message, dict):
            return _webhook_response("ignored", "Unsupported Telegram update type.")

        chat = message.get("chat")
        if not isinstance(chat, dict):
            return _webhook_response("ignored", "Telegram message did not include a chat.")

        chat_type = str(chat.get("type", "unknown"))
        if chat_type != "private":
            return _webhook_response("ignored", "Only private Telegram chats can bind.")

        text = str(message.get("text") or "").strip()
        if not text:
            return _webhook_response("ignored", "Only text commands are supported in this slice.")

        chat_id = str(chat.get("id", "unknown"))
        from_user = message.get("from") if isinstance(message.get("from"), dict) else {}
        user_id = str(from_user.get("id", "unknown")) if isinstance(from_user, dict) else "unknown"
        chat_hash = _hash_provider_id(chat_id)
        user_hash = _hash_provider_id(user_id)
        command, argument = _parse_command(text)

        if command == "/start":
            return self._handle_start(argument, chat_hash, user_hash, chat_id, chat_type, update_id)
        if command == "/pause":
            return self._handle_pause(chat_hash, user_hash, chat_type, update_id)
        if command == "/resume":
            return self._handle_resume(chat_hash, user_hash, chat_type, update_id)
        if command == "/status":
            return self._handle_status(chat_hash, user_hash, chat_type, update_id)
        return self._handle_unknown_text(chat_hash, user_hash, chat_type, update_id)

    def _handle_start(
        self,
        binding_code: str | None,
        chat_hash: str,
        user_hash: str,
        chat_id: str,
        chat_type: str,
        update_id: str,
    ) -> TelegramWebhookResponse:
        if not binding_code:
            return _webhook_response("rejected", "Missing Telegram binding code.", command="/start")

        record = self.bindings.get_by_code_hash(_hash_binding_code(binding_code))
        if record is None:
            return _webhook_response("rejected", "Unknown Telegram binding code.", command="/start")

        now = utc_now()
        if record.binding_code_expires_at <= now:
            expired = self.bindings.mark_expired(record.binding_id)
            return _webhook_response(
                "rejected",
                "Telegram binding code expired.",
                command="/start",
                binding=expired,
            )

        if TelegramBindingStatus(record.status) in {
            TelegramBindingStatus.verified,
            TelegramBindingStatus.paused,
        }:
            if record.telegram_chat_id_hash == chat_hash:
                return _webhook_response(
                    "bound",
                    "Telegram chat already verified.",
                    command="/start",
                    binding=record,
                )
            return _webhook_response(
                "rejected",
                "Telegram binding code was already used by another chat.",
                command="/start",
                binding=record,
            )

        chat_secret_ref = self.secret_provider.store_secret(chat_id, "telegram-chat-id")
        verified = self.bindings.verify_pending(
            record.binding_id,
            chat_hash=chat_hash,
            user_hash=user_hash,
            chat_secret_ref=chat_secret_ref,
            update_id=update_id,
        )
        event = self.bindings.record_event(
            verified,
            event_type="telegram.binding.verified",
            update_id=update_id,
            sanitized_summary="Telegram private chat binding verified.",
            provider_metadata={
                "chat_type": chat_type,
                "telegram_user_id_hash": user_hash,
            },
        )
        return _webhook_response(
            "bound",
            "Telegram private chat verified.",
            command="/start",
            binding=verified,
            event=event,
        )

    def _handle_pause(
        self, chat_hash: str, user_hash: str, chat_type: str, update_id: str
    ) -> TelegramWebhookResponse:
        try:
            record = self.bindings.pause(chat_hash, update_id)
        except TelegramBindingNotFound:
            return _webhook_response("rejected", "Telegram chat is not bound.", command="/pause")
        event = self._record_command_event(
            record, "telegram.command.pause", update_id, user_hash, chat_type
        )
        return _webhook_response(
            "paused",
            "Telegram notifications paused.",
            command="/pause",
            binding=record,
            event=event,
        )

    def _handle_resume(
        self, chat_hash: str, user_hash: str, chat_type: str, update_id: str
    ) -> TelegramWebhookResponse:
        try:
            record = self.bindings.resume(chat_hash, update_id)
        except TelegramBindingNotFound:
            return _webhook_response("rejected", "Telegram chat is not bound.", command="/resume")
        event = self._record_command_event(
            record, "telegram.command.resume", update_id, user_hash, chat_type
        )
        return _webhook_response(
            "resumed",
            "Telegram notifications resumed.",
            command="/resume",
            binding=record,
            event=event,
        )

    def _handle_status(
        self, chat_hash: str, user_hash: str, chat_type: str, update_id: str
    ) -> TelegramWebhookResponse:
        record = self.bindings.get_by_chat_hash(chat_hash)
        if record is None:
            return _webhook_response("rejected", "Telegram chat is not bound.", command="/status")
        event = self._record_command_event(
            record, "telegram.command.status", update_id, user_hash, chat_type
        )
        return _webhook_response(
            "received",
            f"Telegram binding status is {record.status}.",
            command="/status",
            binding=record,
            event=event,
        )

    def _handle_unknown_text(
        self, chat_hash: str, user_hash: str, chat_type: str, update_id: str
    ) -> TelegramWebhookResponse:
        record = self.bindings.get_by_chat_hash(chat_hash)
        if record is None:
            return _webhook_response(
                "rejected", "Telegram chat is not bound.", command="unknown_text"
            )
        event = self.bindings.record_event(
            record,
            event_type="telegram.inbound.text",
            update_id=update_id,
            sanitized_summary=(
                "Telegram text received; assistant question handling is not enabled yet."
            ),
            provider_metadata={
                "chat_type": chat_type,
                "telegram_user_id_hash": user_hash,
                "content_trust": "untrusted",
            },
        )
        return _webhook_response(
            "received",
            "Telegram text recorded as untrusted inbound content.",
            command="unknown_text",
            binding=record,
            event=event,
        )

    def _record_command_event(
        self,
        record: TelegramBindingRecord,
        event_type: str,
        update_id: str,
        user_hash: str,
        chat_type: str,
    ) -> TelegramProvenanceEvent:
        return self.bindings.record_event(
            record,
            event_type=event_type,
            update_id=update_id,
            sanitized_summary=f"{event_type} routed deterministically.",
            provider_metadata={
                "chat_type": chat_type,
                "telegram_user_id_hash": user_hash,
            },
        )

    @property
    def events(self) -> list[TelegramProvenanceEvent]:
        return self.bindings.events()


def _status_response(record: TelegramBindingRecord) -> TelegramBindingStatusResponse:
    status = TelegramBindingStatus(record.status)
    return TelegramBindingStatusResponse(
        binding_id=record.binding_id,
        status=status,
        account_id=record.scope.account_id,
        user_id=record.scope.user_id,
        space_id=record.scope.space_id,
        verified_at=record.verified_at,
        paused=status == TelegramBindingStatus.paused,
        correlation_id=record.correlation_id,
        audit_correlation_id=record.audit_correlation_id,
    )


def _webhook_response(
    status: str,
    detail: str,
    command: str | None = None,
    binding: TelegramBindingRecord | None = None,
    event: TelegramProvenanceEvent | None = None,
) -> TelegramWebhookResponse:
    return TelegramWebhookResponse(
        status=status,
        detail=detail,
        command=command,
        binding_id=binding.binding_id if binding else None,
        event_ref=event.event_ref if event else None,
        correlation_id=binding.correlation_id if binding else str(uuid4()),
    )


def _hash_binding_code(binding_code: str) -> str:
    return hashlib.sha256(f"telegram-binding:{binding_code}".encode()).hexdigest()


def _hash_provider_id(provider_id: str) -> str:
    return hashlib.sha256(f"telegram-provider-id:{provider_id}".encode()).hexdigest()


def _mask_token(token: str) -> str:
    if len(token) <= 4:
        return "***"
    return f"***{token[-4:]}"


def _parse_command(text: str) -> tuple[str, str | None]:
    first, _, rest = text.partition(" ")
    command = first.split("@", 1)[0].lower()
    if not command.startswith("/"):
        return "unknown_text", None
    return command, rest.strip() or None


def constant_time_secret_matches(provided: str | None, expected: str) -> bool:
    if provided is None:
        return False
    return hmac.compare_digest(provided, expected)


def safe_telegram_delivery_error(exc: Exception) -> str:
    if isinstance(exc, TelegramDeliveryError):
        return str(exc)
    return exc.__class__.__name__
