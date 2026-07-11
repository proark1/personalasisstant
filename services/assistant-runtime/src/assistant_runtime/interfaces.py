from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from assistant_runtime.schemas import (
    ActionRecord,
    FirewallDecision,
    JobRecord,
    JsonObject,
    LoginRequest,
    OutboxRow,
    PolicyDecision,
    ProviderAccountRecord,
    ProviderKind,
    ResolvedIdentity,
    SanitizedContent,
    ScopedIdentity,
    SessionRecord,
)


class BrainClient(Protocol):
    async def check_available(self) -> bool: ...

    async def capabilities(self) -> JsonObject: ...

    async def create_assistant_record(
        self,
        *,
        content: str,
        record_type: str,
        purpose: str,
        account_id: str,
        space_id: str,
        title: str = "",
        intent: str = "",
        source: str = "assistant",
        source_ref: str = "",
        metadata: JsonObject | None = None,
        provenance: JsonObject | None = None,
        retention: JsonObject | None = None,
    ) -> JsonObject: ...

    async def get_assistant_record(
        self,
        record_id: str,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
    ) -> JsonObject: ...

    async def list_assistant_records(
        self,
        *,
        account_id: str = "",
        space_id: str = "",
        record_type: str = "",
        intent: str = "",
        purpose: str = "",
        status: str = "",
        limit: int = 50,
    ) -> list[JsonObject]: ...

    async def record_audit_event(
        self,
        *,
        action: str,
        target_type: str,
        target_id: str,
        account_id: str,
        space_id: str,
        purpose: str = "assistant_action",
        decision: str = "recorded",
        metadata: JsonObject | None = None,
    ) -> JsonObject: ...

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None: ...

    async def list_tombstones(self, *, since: int = 0, limit: int = 100) -> JsonObject: ...

    async def ack_tombstone(self, tombstone_id: str) -> JsonObject: ...

    async def delete_record(
        self,
        *,
        source_ref: str,
        account_id: str = "",
        space_id: str = "",
    ) -> JsonObject: ...


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


class OAuthProvider(Protocol):
    def authorization_url(self, provider: ProviderKind, state: str, scopes: list[str]) -> str: ...

    async def exchange_code(
        self, provider: ProviderKind, code: str, redirect_uri: str
    ) -> dict[str, object]: ...


class ProviderAccountStore(Protocol):
    def list_accounts(self) -> list[ProviderAccountRecord]: ...


class SecretProvider(Protocol):
    def store_secret(self, plaintext: str, purpose: str) -> str: ...

    def retrieve_secret(self, secret_ref: str) -> str: ...

    def revoke_secret(self, secret_ref: str) -> None: ...


class IdentityProvider(Protocol):
    """Resolves a login into a OneBrain-scoped identity.

    OneBrain is the identity authority; the concrete provider either delegates to it
    (deferred) or, in dev/test, stubs the resolution.
    """

    @property
    def mode(self) -> str: ...

    async def resolve_login(self, request: LoginRequest) -> ResolvedIdentity | None: ...


class SessionStore(Protocol):
    def create_session(self, record: SessionRecord) -> SessionRecord: ...

    def get_active_session_by_token_hash(self, token_hash: str) -> SessionRecord | None: ...

    def revoke_session(self, session_id: UUID) -> SessionRecord | None: ...

    def touch(self, session_id: UUID) -> None: ...

    def purge_scope(self, account_id: str, space_id: str = "") -> int: ...


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
