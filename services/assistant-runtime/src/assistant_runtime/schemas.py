from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class ActionState(StrEnum):
    proposed = "proposed"
    needs_review = "needs_review"
    approved = "approved"
    executing = "executing"
    executed = "executed"
    failed = "failed"
    cancelled = "cancelled"


class JobState(StrEnum):
    queued = "queued"
    leased = "leased"
    running = "running"
    succeeded = "succeeded"
    retry_wait = "retry_wait"
    failed = "failed"
    dead_lettered = "dead_lettered"
    cancelled = "cancelled"


class OutboxState(StrEnum):
    pending = "pending"
    leased = "leased"
    delivered = "delivered"
    retry_wait = "retry_wait"
    failed = "failed"
    dead_lettered = "dead_lettered"
    cancelled = "cancelled"


class RiskTier(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class ApprovalChannel(StrEnum):
    web = "web"
    telegram = "telegram"
    voice = "voice"
    worker = "worker"
    fresh_auth = "fresh_auth"


class TelegramBindingStatus(StrEnum):
    pending = "pending"
    verified = "verified"
    paused = "paused"
    revoked = "revoked"
    expired = "expired"


class ScopedIdentity(BaseModel):
    account_id: str
    user_id: str
    space_id: str
    purpose: str = "assistant_operations"


class TransitionRecord(BaseModel):
    from_state: ActionState | None
    to_state: ActionState
    actor: str
    channel: ApprovalChannel | None = None
    reason: str
    correlation_id: str
    occurred_at: datetime = Field(default_factory=utc_now)


class ActionRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    action_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    state: ActionState = ActionState.proposed
    action_type: str
    risk_tier: RiskTier
    summary: str
    idempotency_key: str
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    audit_correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    sending_account_ref: str | None = None
    recipient_refs: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)
    changed_fields: list[str] = Field(default_factory=list)
    sensitive_flags: list[str] = Field(default_factory=list)
    approval_reason: str = "User approval required by action policy."
    reversible: bool = False
    external_side_effect: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    transitions: list[TransitionRecord] = Field(default_factory=list)


class ActionCreateRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    action_type: str = "create_email_draft"
    risk_tier: RiskTier = RiskTier.medium
    summary: str = "Draft a reply for review."
    sending_account_ref: str | None = "onebrain://connected-account/demo-mail"
    recipient_refs: list[str] = Field(default_factory=lambda: ["onebrain://contact/client"])
    source_refs: list[str] = Field(default_factory=lambda: ["onebrain://message/source-demo"])
    changed_fields: list[str] = Field(default_factory=lambda: ["subject", "body"])
    sensitive_flags: list[str] = Field(default_factory=list)
    reversible: bool = True
    external_side_effect: bool = True
    idempotency_key: str | None = None


class ActionApprovalRequest(BaseModel):
    channel: ApprovalChannel = ApprovalChannel.web
    actor: str = "user_demo"
    fresh_auth: bool = False


class PolicyDecision(BaseModel):
    allowed: bool
    risk_tier: RiskTier
    requires_approval: bool
    allowed_channels: list[ApprovalChannel]
    reason: str
    blocked_reasons: list[str] = Field(default_factory=list)


class OutboxRow(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    outbox_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    action_id: UUID | None = None
    state: OutboxState = OutboxState.pending
    effect_type: str
    payload_ref: str
    idempotency_key: str
    correlation_id: str
    audit_correlation_id: str
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None
    retry_count: int = 0
    next_run_at: datetime = Field(default_factory=utc_now)
    last_error: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class JobRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    job_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    state: JobState = JobState.queued
    job_type: str
    payload_ref: str
    idempotency_key: str
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    audit_correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    timezone: str
    run_at: datetime
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None
    retry_count: int = 0
    last_error: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SecretEnvelope(BaseModel):
    secret_ref: str
    ciphertext: str
    key_version: str
    created_at: datetime = Field(default_factory=utc_now)
    last_used_at: datetime | None = None
    rotated_at: datetime | None = None
    revoked_at: datetime | None = None


class HealthResponse(BaseModel):
    service: str
    status: str
    version: str
    degraded: bool
    checks: dict[str, str]
    correlation_id: str


class ProviderHealth(BaseModel):
    provider: str
    status: str
    detail: str
    checked_at: datetime = Field(default_factory=utc_now)


class NavigationItem(BaseModel):
    key: str
    label: str
    href: str
    count: int | None = None


class TodayBriefItem(BaseModel):
    title: str
    detail: str
    source_ref: str
    status: str = "ready"


class ApprovalCard(BaseModel):
    action_id: str
    action_type: str
    risk_tier: RiskTier
    summary: str
    sending_account: str
    recipient_refs: list[str]
    source_ref: str
    changed_fields: list[str]
    sensitive_flags: list[str]
    approval_reason: str
    reversible: bool
    primary_channel: str


class DegradedModeState(BaseModel):
    active: bool
    reason: str | None = None
    blocked_actions: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)


class TodayResponse(BaseModel):
    account_id: str
    user_id: str
    space_id: str
    local_date: str
    navigation: list[NavigationItem]
    brief: list[TodayBriefItem]
    approvals: list[ApprovalCard]
    provider_health: list[ProviderHealth]
    degraded_mode: DegradedModeState


class SanitizedContent(BaseModel):
    safe_text: str
    removed_markers: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)


class FirewallDecision(BaseModel):
    safe_for_model_context: bool
    can_create_action_from_raw_content: bool = False
    extracted_intent: str | None = None
    proposed_recipient_refs: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    blocked_reasons: list[str] = Field(default_factory=list)


class SecurityInspectionRequest(BaseModel):
    html: str
    source_ref: str = "onebrain://fixture/untrusted"


class SecurityInspectionResponse(BaseModel):
    sanitized: SanitizedContent
    firewall: FirewallDecision


class TelegramSetupRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    bot_token: str = Field(min_length=8)
    expires_in_seconds: int = Field(default=600, ge=0, le=3600)


class TelegramSetupResponse(BaseModel):
    binding_id: UUID
    status: TelegramBindingStatus
    bot_secret_ref: str
    token_preview: str
    binding_code: str
    binding_command: str
    expires_at: datetime
    correlation_id: str
    audit_correlation_id: str


class TelegramBindingRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    binding_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    status: TelegramBindingStatus = TelegramBindingStatus.pending
    bot_secret_ref: str
    binding_code_hash: str
    binding_code_expires_at: datetime
    telegram_chat_id_hash: str | None = None
    telegram_user_id_hash: str | None = None
    telegram_chat_secret_ref: str | None = None
    verified_at: datetime | None = None
    revoked_at: datetime | None = None
    last_update_id: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    audit_correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class TelegramBindingStatusResponse(BaseModel):
    binding_id: UUID
    status: TelegramBindingStatus
    account_id: str
    user_id: str
    space_id: str
    verified_at: datetime | None = None
    paused: bool = False
    correlation_id: str
    audit_correlation_id: str


class TelegramProvenanceEvent(BaseModel):
    event_ref: str
    binding_id: UUID
    event_type: str
    source_update_ref: str
    sanitized_summary: str
    scope: ScopedIdentity
    provider_metadata: dict[str, str] = Field(default_factory=dict)
    correlation_id: str
    audit_correlation_id: str
    occurred_at: datetime = Field(default_factory=utc_now)


class TelegramWebhookResponse(BaseModel):
    status: str
    detail: str
    command: str | None = None
    binding_id: UUID | None = None
    event_ref: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))


JsonObject = dict[str, Any]
