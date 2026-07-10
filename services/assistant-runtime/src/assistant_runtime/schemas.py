from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from assistant_runtime.contracts import (
    ASSISTANT_PURPOSES,
    contains_secret_reference,
    copy_metadata,
    default_assistant_intent,
    validate_assistant_contract_names,
)


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


class ProviderKind(StrEnum):
    google = "google"
    microsoft = "microsoft"


class ProviderService(StrEnum):
    mail = "mail"
    calendar = "calendar"


class ProviderAccountStatus(StrEnum):
    not_configured = "not_configured"
    connecting = "connecting"
    connected = "connected"
    degraded = "degraded"
    disconnected = "disconnected"
    revoked = "revoked"


class ProviderSyncState(StrEnum):
    idle = "idle"
    queued = "queued"
    syncing = "syncing"
    healthy = "healthy"
    degraded = "degraded"
    failed = "failed"


class ProviderFailureClass(StrEnum):
    throttled = "throttled"
    transient = "transient"
    provider_unavailable = "provider_unavailable"
    auth = "auth"
    cursor_expired = "cursor_expired"
    permanent = "permanent"


class ProviderOperationalSyncStatus(StrEnum):
    healthy = "healthy"
    degraded = "degraded"
    throttled = "throttled"
    auth_required = "auth_required"
    stale = "stale"
    paused = "paused"


class OAuthConnectionStatus(StrEnum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"
    expired = "expired"


class OAuthScopeTier(StrEnum):
    read_only = "read_only"
    draft_write = "draft_write"
    send = "send"
    calendar_write = "calendar_write"


class ScopedIdentity(BaseModel):
    account_id: str
    user_id: str
    space_id: str
    purpose: str = "assistant_operations"


# --- Auth & session -------------------------------------------------------
# Assistant-side session references only. OneBrain remains the identity authority;
# minting a session is delegated to an IdentityProvider (see auth/identity.py).


class ResolvedIdentity(BaseModel):
    """Identity resolved by an IdentityProvider at login time."""

    account_id: str
    user_id: str
    space_id: str
    identity_source: str = "stub"

    def to_scope(self, purpose: str = "assistant_operations") -> ScopedIdentity:
        return ScopedIdentity(
            account_id=self.account_id,
            user_id=self.user_id,
            space_id=self.space_id,
            purpose=purpose,
        )


class SessionRecord(BaseModel):
    """A durable-by-reference assistant session. Stores only a token hash."""

    session_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    token_hash: str
    identity_source: str = "stub"
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None

    def is_active(self, now: datetime | None = None) -> bool:
        moment = now or utc_now()
        return self.revoked_at is None and self.expires_at > moment


class AuthPrincipal(BaseModel):
    """Verified caller identity yielded by the auth guard."""

    session_id: UUID
    scope: ScopedIdentity
    identity_source: str
    expires_at: datetime
    last_used_at: datetime | None = None


class LoginRequest(BaseModel):
    # OneBrain identity handoff: the user's OneBrain credentials, verified by the
    # OneBrain identity endpoint. Never stored by the assistant.
    email: str | None = None
    password: str | None = None
    # Stub/dev mode only: optional scope overrides (ignored by the OneBrain provider).
    account_id: str | None = None
    user_id: str | None = None
    space_id: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    session_id: UUID
    scope: ScopedIdentity
    identity_source: str
    expires_at: datetime


class SessionResponse(BaseModel):
    session_id: UUID
    scope: ScopedIdentity
    identity_source: str
    expires_at: datetime
    last_used_at: datetime | None = None


class LogoutResponse(BaseModel):
    status: str = "revoked"
    detail: str = "Session revoked."


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


class ProviderConfigurationStatus(BaseModel):
    provider: ProviderKind
    display_name: str
    configured: bool
    missing_config: list[str] = Field(default_factory=list)
    read_scopes: list[str] = Field(default_factory=list)
    upgrade_scopes: dict[str, list[str]] = Field(default_factory=dict)


class ProviderCapabilityStatus(BaseModel):
    key: str
    label: str
    service: ProviderService
    granted: bool
    required_scopes: list[str] = Field(default_factory=list)
    upgrade_tier: OAuthScopeTier = OAuthScopeTier.read_only


class OAuthConnectionAttemptRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    connection_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    provider: ProviderKind
    state_hash: str
    requested_scope_tier: OAuthScopeTier = OAuthScopeTier.read_only
    requested_scopes: list[str] = Field(default_factory=list)
    requested_services: list[ProviderService] = Field(
        default_factory=lambda: [ProviderService.mail, ProviderService.calendar]
    )
    redirect_uri: str
    status: OAuthConnectionStatus = OAuthConnectionStatus.pending
    expires_at: datetime
    error_detail: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    audit_correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProviderOAuthStartRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    requested_scope_tier: OAuthScopeTier = OAuthScopeTier.read_only
    requested_services: list[ProviderService] = Field(
        default_factory=lambda: [ProviderService.mail, ProviderService.calendar]
    )
    redirect_path: str = Field(default="/settings/providers", max_length=200)

    @field_validator("redirect_path")
    @classmethod
    def _local_redirect_path_only(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("redirect_path must be an app-local path.")
        return value


class ProviderOAuthStartResponse(BaseModel):
    provider: ProviderKind
    connection_id: UUID | None = None
    authorization_url: str | None = None
    configured: bool
    requested_scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None
    detail: str


class ProviderOAuthCallbackResponse(BaseModel):
    provider: ProviderKind
    status: OAuthConnectionStatus
    provider_account_id: UUID | None = None
    detail: str
    redirect_to: str


class ProviderAccountRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    provider_account_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    provider: ProviderKind
    provider_account_ref: str
    provider_subject: str
    email: str = ""
    display_name: str = ""
    status: ProviderAccountStatus = ProviderAccountStatus.connected
    sync_state: ProviderSyncState = ProviderSyncState.idle
    granted_scopes: list[str] = Field(default_factory=list)
    scope_tier: OAuthScopeTier = OAuthScopeTier.read_only
    mail_enabled: bool = True
    calendar_enabled: bool = True
    refresh_token_secret_ref: str
    token_expires_at: datetime | None = None
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_status: ProviderOperationalSyncStatus = ProviderOperationalSyncStatus.healthy
    last_sync_error_class: ProviderFailureClass | None = None
    retry_after: datetime | None = None
    stale_since: datetime | None = None
    last_status_detail: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    audit_correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProviderAccountSummary(BaseModel):
    provider_account_id: UUID
    provider: ProviderKind
    provider_account_ref: str
    email: str
    display_name: str
    status: ProviderAccountStatus
    sync_state: ProviderSyncState
    granted_scopes: list[str]
    missing_scopes: list[str]
    scope_tier: OAuthScopeTier
    capabilities: list[ProviderCapabilityStatus]
    mail_enabled: bool
    calendar_enabled: bool
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_status: ProviderOperationalSyncStatus = ProviderOperationalSyncStatus.healthy
    last_sync_error_class: ProviderFailureClass | None = None
    retry_after: datetime | None = None
    stale_since: datetime | None = None
    last_status_detail: str | None = None
    checked_at: datetime = Field(default_factory=utc_now)


class ProviderAccountsResponse(BaseModel):
    accounts: list[ProviderAccountSummary] = Field(default_factory=list)


class ProviderStatusResponse(BaseModel):
    providers: list[ProviderConfigurationStatus] = Field(default_factory=list)
    accounts: list[ProviderAccountSummary] = Field(default_factory=list)


class ProviderSyncRequest(BaseModel):
    sync_kind: str = Field(default="reconcile", pattern="^(initial|reconcile|manual)$")


class ProviderSyncResponse(BaseModel):
    status: str
    detail: str
    job: JobRecord | None = None


class ProviderAccountHealthResponse(BaseModel):
    provider_account_id: UUID
    provider: ProviderKind
    status: ProviderAccountStatus
    sync_state: ProviderSyncState
    detail: str
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_status: ProviderOperationalSyncStatus = ProviderOperationalSyncStatus.healthy
    last_sync_error_class: ProviderFailureClass | None = None
    retry_after: datetime | None = None
    stale_since: datetime | None = None
    last_status_detail: str | None = None


class ProviderDisconnectResponse(BaseModel):
    status: ProviderAccountStatus
    detail: str


class ProviderWebhookResponse(BaseModel):
    provider: ProviderKind
    status: str
    detail: str
    deduplicated: bool = False
    job: JobRecord | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))


class SyncCursorRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    cursor_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    provider: ProviderKind
    provider_account_id: UUID
    provider_account_ref: str
    cursor_kind: str
    cursor_value: str
    cursor_ref: str
    reconciliation_state: str = "current"
    last_success_at: datetime | None = None
    last_error: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProviderSubscriptionRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    subscription_id: UUID = Field(default_factory=uuid4)
    scope: ScopedIdentity
    provider: ProviderKind
    provider_account_id: UUID
    provider_account_ref: str
    subscription_kind: str
    subscription_ref: str
    resource_ref: str
    state: str = "active"
    expires_at: datetime | None = None
    renewal_job_id: UUID | None = None
    secret_ref: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


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


class WorkdayPartialState(BaseModel):
    durable: bool = False
    degraded: bool = False
    reasons: list[str] = Field(default_factory=list)
    missing_sources: list[str] = Field(default_factory=list)
    stale_sources: list[str] = Field(default_factory=list)
    generated_from: str = "rules"
    onebrain_available: bool = True
    provider_accounts_seen: int = 0


class PriorityItem(BaseModel):
    priority_id: str
    title: str
    detail: str
    score: int = Field(ge=0, le=100)
    reason: str
    status: str = "ready"
    source_refs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.75, ge=0, le=1)


class InboxTriageItem(BaseModel):
    item_id: str
    subject: str
    sender: str
    category: str
    reason: str
    source_ref: str
    account_ref: str = ""
    received_at: datetime = Field(default_factory=utc_now)
    priority_score: int = Field(default=50, ge=0, le=100)
    confidence: float = Field(default=0.7, ge=0, le=1)
    flags: list[str] = Field(default_factory=list)


class FollowUpRisk(BaseModel):
    risk_id: str
    title: str
    detail: str
    owner: str
    status: str = "watch"
    reason: str
    source_refs: list[str] = Field(default_factory=list)
    due_at: datetime | None = None
    confidence: float = Field(default=0.7, ge=0, le=1)


class CalendarFocusWindow(BaseModel):
    window_id: str
    start_at: datetime
    end_at: datetime
    quality: str
    reason: str


class CalendarInsight(BaseModel):
    insight_id: str
    title: str
    detail: str
    severity: str = "info"
    source_refs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.7, ge=0, le=1)
    focus_windows: list[CalendarFocusWindow] = Field(default_factory=list)
    move_candidates: list[str] = Field(default_factory=list)


class TeachingSignal(BaseModel):
    signal_id: str
    target_ref: str
    signal_type: str
    label: str
    source_ref: str
    created_at: datetime = Field(default_factory=utc_now)


class WorkdayBrief(BaseModel):
    brief_id: str
    title: str
    summary: str
    items: list[TodayBriefItem] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=utc_now)
    local_date: str
    source_refs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.75, ge=0, le=1)
    partial_state: WorkdayPartialState = Field(default_factory=WorkdayPartialState)


class WorkdaySnapshot(BaseModel):
    account_id: str
    user_id: str
    space_id: str
    local_date: str
    generated_at: datetime = Field(default_factory=utc_now)
    brief: WorkdayBrief
    priorities: list[PriorityItem] = Field(default_factory=list)
    inbox: list[InboxTriageItem] = Field(default_factory=list)
    follow_ups: list[FollowUpRisk] = Field(default_factory=list)
    calendar: list[CalendarInsight] = Field(default_factory=list)
    provider_health: list[ProviderHealth] = Field(default_factory=list)
    approvals: list[ApprovalCard] = Field(default_factory=list)
    navigation: list[NavigationItem] = Field(default_factory=list)
    partial_state: WorkdayPartialState = Field(default_factory=WorkdayPartialState)
    proactive_suggestion: str = ""


class WorkdayBriefResponse(BaseModel):
    brief: WorkdayBrief
    partial_state: WorkdayPartialState


class WorkdayInboxResponse(BaseModel):
    items: list[InboxTriageItem] = Field(default_factory=list)
    partial_state: WorkdayPartialState


class WorkdayFollowUpsResponse(BaseModel):
    risks: list[FollowUpRisk] = Field(default_factory=list)
    partial_state: WorkdayPartialState


class WorkdayCalendarResponse(BaseModel):
    insights: list[CalendarInsight] = Field(default_factory=list)
    partial_state: WorkdayPartialState


class WorkdayRegenerateRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    local_date: str | None = None
    timezone: str = "UTC"


class WorkdayRegenerateResponse(BaseModel):
    status: str
    detail: str
    snapshot: WorkdaySnapshot
    job: JobRecord | None = None


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
    priorities: list[PriorityItem] = Field(default_factory=list)
    follow_ups: list[FollowUpRisk] = Field(default_factory=list)
    calendar: list[CalendarInsight] = Field(default_factory=list)
    inbox_count: int = 0
    proactive_suggestion: str = ""
    partial_state: WorkdayPartialState = Field(default_factory=WorkdayPartialState)


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


class BrainRecordCreateRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    content: str = Field(min_length=1, max_length=20000)
    record_type: str = Field(min_length=1, max_length=80)
    purpose: str = Field(default="assistant_context", max_length=80)
    title: str = Field(default="", max_length=200)
    intent: str = Field(default="", max_length=80)
    source: str = Field(default="assistant", max_length=80)
    source_ref: str = Field(default="", max_length=200)
    metadata: JsonObject = Field(default_factory=dict)
    provenance: JsonObject = Field(default_factory=dict)
    retention: JsonObject = Field(default_factory=dict)

    @field_validator("record_type", "purpose", "intent", "source", "source_ref", mode="before")
    @classmethod
    def _strip_contract_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _validate_assistant_contract(self) -> BrainRecordCreateRequest:
        if not self.intent:
            self.intent = default_assistant_intent(self.record_type)
        validate_assistant_contract_names(
            record_type=self.record_type,
            purpose=self.purpose,
            intent=self.intent,
        )
        self.metadata = copy_metadata(self.metadata, "metadata")
        self.provenance = copy_metadata(self.provenance, "provenance")
        self.retention = copy_metadata(self.retention, "retention")
        if self.record_type == "secret_reference" and not contains_secret_reference(self.metadata):
            raise ValueError("secret_reference records must identify a secret_ref.")
        return self


class BrainRecordResponse(BaseModel):
    record: JsonObject


class BrainRecordListResponse(BaseModel):
    records: list[JsonObject] = Field(default_factory=list)


class BrainAuditEventRequest(BaseModel):
    scope: ScopedIdentity = Field(
        default_factory=lambda: ScopedIdentity(
            account_id="acct_demo", user_id="user_demo", space_id="space_demo"
        )
    )
    action: str = Field(min_length=1, max_length=120)
    target_type: str = Field(min_length=1, max_length=80)
    target_id: str = Field(min_length=1, max_length=200)
    purpose: str = Field(default="assistant_action", max_length=80)
    decision: str = Field(default="recorded", max_length=80)
    metadata: JsonObject = Field(default_factory=dict)

    @field_validator("action", "target_type", "target_id", "purpose", "decision", mode="before")
    @classmethod
    def _strip_audit_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _validate_assistant_audit_contract(self) -> BrainAuditEventRequest:
        if not self.action.startswith("assistant."):
            raise ValueError("Assistant audit actions must use the assistant.* namespace.")
        if self.purpose not in ASSISTANT_PURPOSES:
            raise ValueError(f"Unknown assistant purpose: {self.purpose}")
        self.metadata = copy_metadata(self.metadata, "metadata")
        return self


class BrainAuditEventResponse(BaseModel):
    event: JsonObject


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


class TelegramTestMessageRequest(BaseModel):
    message: str = Field(
        default="Telegram is connected to your OneBrain assistant.",
        min_length=1,
        max_length=240,
    )
    idempotency_key: str | None = None


class TelegramTestMessageResponse(BaseModel):
    status: str
    detail: str
    binding_id: UUID
    outbox_id: UUID
    delivery_ref: str
    event_ref: str
    correlation_id: str
    audit_correlation_id: str


class TelegramDeliveryRecord(BaseModel):
    delivery_ref: str
    binding_id: UUID
    message: str
    idempotency_key: str
    state: OutboxState = OutboxState.pending
    provider_response_ref: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


JsonObject = dict[str, Any]
