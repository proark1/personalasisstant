from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from assistant_runtime import __version__
from assistant_runtime.channels.telegram import (
    TelegramBindingNotFound,
    TelegramBindingNotReady,
    constant_time_secret_matches,
)
from assistant_runtime.config import Settings, get_settings
from assistant_runtime.domain.action_store import InvalidActionTransition
from assistant_runtime.domain.queue import InMemoryQueueProvider, InMemorySchedulerProvider
from assistant_runtime.logging import configure_logging
from assistant_runtime.observability import (
    InMemoryObservabilityProvider,
    RequestContextMiddleware,
    current_request_id,
    metrics_response,
)
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.runtime_stores import build_operational_stores
from assistant_runtime.schemas import (
    ActionApprovalRequest,
    ActionCreateRequest,
    ActionRecord,
    ApprovalCard,
    ApprovalChannel,
    DegradedModeState,
    HealthResponse,
    NavigationItem,
    ProviderHealth,
    RiskTier,
    SecurityInspectionRequest,
    SecurityInspectionResponse,
    TelegramBindingStatusResponse,
    TelegramSetupRequest,
    TelegramSetupResponse,
    TelegramTestMessageRequest,
    TelegramTestMessageResponse,
    TelegramWebhookResponse,
    TodayBriefItem,
    TodayResponse,
)
from assistant_runtime.security.content_sanitizer import HtmlContentSanitizer
from assistant_runtime.security.instruction_firewall import BasicInstructionFirewall


class RuntimeContainer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        operational = build_operational_stores(settings)
        self.actions = operational.actions
        self.outbox = operational.outbox
        self.secrets = operational.secrets
        self.telegram = operational.telegram
        self.queue = InMemoryQueueProvider()
        self.scheduler = InMemorySchedulerProvider(self.queue)
        self.policy = AssistantActionPolicyEngine()
        self.sanitizer = HtmlContentSanitizer()
        self.firewall = BasicInstructionFirewall()
        self.observability = InMemoryObservabilityProvider()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    container = RuntimeContainer(settings)

    app = FastAPI(
        title="OneBrain Assistant API",
        version=__version__,
        description="Thin orchestration API for the OneBrain assistant.",
    )
    app.state.container = container
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=[
            "authorization",
            "content-type",
            "x-request-id",
            "x-telegram-bot-api-secret-token",
        ],
    )

    @app.get("/health/live", response_model=HealthResponse)
    async def live() -> HealthResponse:
        return HealthResponse(
            service=settings.service_name,
            status="ok",
            version=__version__,
            degraded=False,
            checks={"api": "ok"},
            correlation_id=current_request_id(),
        )

    @app.get("/health/ready", response_model=HealthResponse)
    async def ready() -> HealthResponse:
        degraded = not settings.onebrain_available
        return HealthResponse(
            service=settings.service_name,
            status="degraded" if degraded else "ok",
            version=__version__,
            degraded=degraded,
            checks={
                "api": "ok",
                "postgres_schema": "configured",
                "redis": "configured",
                "onebrain": "ok" if settings.onebrain_available else "unavailable",
            },
            correlation_id=current_request_id(),
        )

    @app.get("/metrics")
    async def metrics():
        return metrics_response()

    @app.get("/v1/today", response_model=TodayResponse)
    async def today() -> TodayResponse:
        return build_today_response(container)

    @app.post("/v1/actions", response_model=ActionRecord, status_code=201)
    async def create_action(request: ActionCreateRequest) -> ActionRecord:
        action = container.actions.create(request)
        container.observability.increment(
            "action_proposed",
            {"risk_tier": str(action.risk_tier), "action_type": action.action_type},
        )
        return action

    @app.post("/v1/actions/{action_id}/approve", response_model=ActionRecord)
    async def approve_action(action_id: UUID, request: ActionApprovalRequest) -> ActionRecord:
        action = container.actions.get(action_id)
        if action is None:
            raise HTTPException(status_code=404, detail="Action not found")

        channel = ApprovalChannel.fresh_auth if request.fresh_auth else request.channel
        decision = container.policy.evaluate(
            action,
            channel=channel,
            fresh_auth=request.fresh_auth,
            onebrain_available=settings.onebrain_available,
        )
        if not decision.allowed:
            raise HTTPException(status_code=409, detail=decision.model_dump(mode="json"))

        payload_ref = f"onebrain://action/{action.action_id}/approved-snapshot"
        approve_with_outbox = getattr(container.actions, "approve_with_outbox", None)
        try:
            if action.external_side_effect and approve_with_outbox is not None:
                approved, _ = approve_with_outbox(
                    action.action_id,
                    request.actor,
                    channel,
                    decision.reason,
                    "action.execution.requested",
                    payload_ref,
                )
            else:
                approved = container.actions.approve(
                    action.action_id,
                    actor=request.actor,
                    channel=channel,
                    reason=decision.reason,
                )
        except InvalidActionTransition as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        if approved.external_side_effect and approve_with_outbox is None:
            container.outbox.create_for_action(
                approved,
                effect_type="action.execution.requested",
                payload_ref=payload_ref,
            )
        container.observability.increment(
            "action_approved",
            {"risk_tier": str(approved.risk_tier), "channel": str(channel)},
        )
        return approved

    @app.post("/v1/security/inspect", response_model=SecurityInspectionResponse)
    async def inspect_untrusted_content(
        request: SecurityInspectionRequest,
    ) -> SecurityInspectionResponse:
        sanitized = container.sanitizer.sanitize_html(request.html)
        firewall = container.firewall.inspect(sanitized, request.source_ref)
        return SecurityInspectionResponse(sanitized=sanitized, firewall=firewall)

    @app.post("/v1/telegram/setup", response_model=TelegramSetupResponse, status_code=201)
    async def telegram_setup(request: TelegramSetupRequest) -> TelegramSetupResponse:
        setup = container.telegram.create_setup(request)
        container.observability.increment("telegram_setup", {"status": str(setup.status)})
        return setup

    @app.get(
        "/v1/telegram/bindings/{binding_id}",
        response_model=TelegramBindingStatusResponse,
    )
    async def telegram_binding_status(binding_id: UUID) -> TelegramBindingStatusResponse:
        try:
            return container.telegram.binding_status(binding_id)
        except TelegramBindingNotFound as exc:
            raise HTTPException(status_code=404, detail="Telegram binding not found") from exc

    @app.post(
        "/v1/telegram/bindings/{binding_id}/test-message",
        response_model=TelegramTestMessageResponse,
        status_code=202,
    )
    async def telegram_test_message(
        binding_id: UUID, request: TelegramTestMessageRequest
    ) -> TelegramTestMessageResponse:
        try:
            queued = container.telegram.queue_test_message(binding_id, request, container.outbox)
        except TelegramBindingNotFound as exc:
            raise HTTPException(status_code=404, detail="Telegram binding not found") from exc
        except TelegramBindingNotReady as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        container.observability.increment("telegram_test_message", {"status": queued.status})
        return queued

    @app.post("/v1/telegram/webhook", response_model=TelegramWebhookResponse)
    async def telegram_webhook(
        payload: dict[str, object],
        telegram_secret: str | None = Header(
            default=None, alias="X-Telegram-Bot-Api-Secret-Token"
        ),
    ) -> TelegramWebhookResponse:
        if not constant_time_secret_matches(telegram_secret, settings.telegram_webhook_secret):
            container.observability.increment("telegram_inbound", {"status": "unauthorized"})
            raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret")
        result = await container.telegram.receive(payload)
        container.observability.increment("telegram_inbound", {"status": result.status})
        return result

    return app


def build_today_response(container: RuntimeContainer) -> TodayResponse:
    settings = container.settings
    degraded = not settings.onebrain_available
    action = _ensure_sample_action(container)
    return TodayResponse(
        account_id=action.scope.account_id,
        user_id=action.scope.user_id,
        space_id=action.scope.space_id,
        local_date=datetime.now(UTC).date().isoformat(),
        navigation=[
            NavigationItem(key="today", label="Today", href="/"),
            NavigationItem(key="inbox", label="Inbox Review", href="/inbox", count=3),
            NavigationItem(key="followups", label="Follow-Ups", href="/follow-ups", count=2),
            NavigationItem(key="calendar", label="Calendar Plan", href="/calendar"),
            NavigationItem(key="assistant", label="Assistant", href="/assistant"),
            NavigationItem(key="settings", label="Settings", href="/settings"),
        ],
        brief=[
            TodayBriefItem(
                title="Morning brief",
                detail="Three priority threads, two follow-ups, one protected focus block.",
                source_ref="onebrain://brief/today",
            ),
            TodayBriefItem(
                title="Calendar pressure",
                detail="The afternoon is full; move low-priority admin work before 11:00.",
                source_ref="onebrain://calendar/workload/today",
                status="watch",
            ),
            TodayBriefItem(
                title="Important relationship",
                detail="Client response is waiting; tone profile suggests a short direct reply.",
                source_ref="onebrain://relationship/client-demo",
            ),
        ],
        approvals=[
            ApprovalCard(
                action_id=str(action.action_id),
                action_type=action.action_type,
                risk_tier=RiskTier(action.risk_tier),
                summary=action.summary,
                sending_account=action.sending_account_ref or "onebrain://connected-account/demo",
                recipient_refs=action.recipient_refs,
                source_ref=action.source_refs[0]
                if action.source_refs
                else "onebrain://source/demo",
                changed_fields=action.changed_fields,
                sensitive_flags=action.sensitive_flags,
                approval_reason=action.approval_reason,
                reversible=action.reversible,
                primary_channel="web"
                if RiskTier(action.risk_tier) == RiskTier.high
                else "web_or_telegram",
            )
        ],
        provider_health=[
            ProviderHealth(
                provider="OneBrain",
                status="ok" if not degraded else "degraded",
                detail=settings.onebrain_api_url,
            ),
            ProviderHealth(provider="Postgres", status="configured", detail="Operational store"),
            ProviderHealth(provider="Redis", status="configured", detail="Queue and scheduler"),
            ProviderHealth(
                provider="Telegram",
                status="binding-ready",
                detail="NotificationChannel setup and webhook binding boundary",
            ),
        ],
        degraded_mode=DegradedModeState(
            active=degraded,
            reason="OneBrain unavailable" if degraded else None,
            blocked_actions=[
                "external sends",
                "email forwards",
                "deletes",
                "external calendar writes",
                "sensitive exports",
            ]
            if degraded
            else [],
            allowed_actions=[
                "cached read-only UI",
                "safe reconciliation jobs",
                "operational retries",
                "provider health checks",
            ],
        ),
    )


def _ensure_sample_action(container: RuntimeContainer) -> ActionRecord:
    request = ActionCreateRequest(
        action_type="create_email_draft",
        risk_tier=RiskTier.medium,
        summary="Draft a concise reply for review.",
        changed_fields=["subject", "body"],
        reversible=True,
        external_side_effect=True,
        idempotency_key="phase0-sample-action",
    )
    return container.actions.create(request)
