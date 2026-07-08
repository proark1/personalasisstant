from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from assistant_runtime.schemas import (
    ActionRecord,
    FirewallDecision,
    JobRecord,
    OutboxRow,
    PolicyDecision,
    SanitizedContent,
    ScopedIdentity,
)


class BrainClient(Protocol):
    async def check_available(self) -> bool: ...

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None: ...


class LLMProvider(Protocol):
    async def classify(self, task: str, context_ref: str) -> str: ...

    async def draft(self, task: str, context_ref: str) -> str: ...


class SpeechToTextProvider(Protocol):
    async def transcribe(self, audio_ref: str) -> str: ...


class TextToSpeechProvider(Protocol):
    async def synthesize(self, text: str, voice: str) -> str: ...


class NotificationChannel(Protocol):
    async def send(self, user_ref: str, message_ref: str, correlation_id: str) -> str: ...

    async def receive(self, payload: dict[str, object]) -> str: ...


class EmailConnector(Protocol):
    async def sync(self, scope: ScopedIdentity, cursor_ref: str | None) -> str: ...

    async def draft_after_approval(self, action: ActionRecord) -> str: ...


class CalendarConnector(Protocol):
    async def availability(self, scope: ScopedIdentity, window_start: datetime) -> str: ...

    async def write_after_approval(self, action: ActionRecord) -> str: ...


class QueueProvider(Protocol):
    async def enqueue(self, job: JobRecord) -> JobRecord: ...

    async def lease_next(self, worker_id: str) -> JobRecord | None: ...


class SchedulerProvider(Protocol):
    async def schedule_local_time(
        self, scope: ScopedIdentity, job_type: str, local_time: str, timezone: str
    ) -> JobRecord: ...


class OutboxProvider(Protocol):
    async def add(self, row: OutboxRow) -> OutboxRow: ...

    async def lease_next(self, worker_id: str) -> OutboxRow | None: ...


class OperationalStore(Protocol):
    async def get_action(self, action_id: UUID) -> ActionRecord | None: ...


class SyncProvider(Protocol):
    async def renew_subscription(self, provider_account_ref: str) -> str: ...

    async def reconcile(self, provider_account_ref: str, cursor_ref: str | None) -> str: ...


class SecretProvider(Protocol):
    def store_secret(self, plaintext: str, purpose: str) -> str: ...

    def retrieve_secret(self, secret_ref: str) -> str: ...

    def revoke_secret(self, secret_ref: str) -> None: ...


class ContentSanitizer(Protocol):
    def sanitize_html(self, html: str) -> SanitizedContent: ...


class InstructionFirewall(Protocol):
    def inspect(self, content: SanitizedContent, source_ref: str) -> FirewallDecision: ...


class ActionPolicyEngine(Protocol):
    def evaluate(self, action: ActionRecord, channel: str, fresh_auth: bool) -> PolicyDecision: ...


class ActionStore(Protocol):
    def propose(self, action: ActionRecord) -> ActionRecord: ...

    def transition(
        self, action_id: UUID, to_state: str, actor: str, reason: str
    ) -> ActionRecord: ...


class StorageProvider(Protocol):
    async def put_temporary(self, data: bytes, content_type: str) -> str: ...


class ObservabilityProvider(Protocol):
    def increment(self, metric_name: str, labels: dict[str, str] | None = None) -> None: ...
