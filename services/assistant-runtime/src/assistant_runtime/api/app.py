from __future__ import annotations

import json
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from assistant_runtime import __version__
from assistant_runtime.api.auth import require_principal, require_scope_match
from assistant_runtime.auth.identity import IdentityAuthorityUnavailable, build_identity_provider
from assistant_runtime.channels.telegram import (
    TelegramBindingNotFound,
    TelegramBindingNotReady,
    constant_time_secret_matches,
)
from assistant_runtime.config import Settings, get_settings
from assistant_runtime.domain.action_store import InvalidActionTransition
from assistant_runtime.domain.providers import summarize_provider_account
from assistant_runtime.domain.sessions import mint_session
from assistant_runtime.domain.workday import (
    WorkdayLoopProcessor,
    workday_snapshot_to_today_response,
)
from assistant_runtime.health import dependency_checks
from assistant_runtime.logging import configure_logging
from assistant_runtime.observability import (
    InMemoryObservabilityProvider,
    RequestContextMiddleware,
    current_request_id,
    metrics_response,
)
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.providers.oauth import (
    OAuthExchangeError,
    ProviderOAuthClient,
    hash_oauth_state,
    new_oauth_state,
    oauth_attempt_expiry,
    scopes_for,
    token_display_name,
    token_email,
    token_expires_at,
    token_scopes,
    token_subject,
)
from assistant_runtime.providers.onebrain import (
    OneBrainClientError,
    build_brain_client,
    write_contract_status,
)
from assistant_runtime.providers.onebrain_events import (
    record_provider_account_connected,
    record_provider_health_event,
    record_provider_scope_grant,
    record_telegram_event,
)
from assistant_runtime.runtime_stores import build_operational_stores
from assistant_runtime.schemas import (
    ActionApprovalRequest,
    ActionCreateRequest,
    ActionRecord,
    ActionState,
    ApprovalCard,
    ApprovalChannel,
    AuthPrincipal,
    BrainAuditEventRequest,
    BrainAuditEventResponse,
    BrainRecordCreateRequest,
    BrainRecordListResponse,
    BrainRecordResponse,
    HealthResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    OAuthConnectionAttemptRecord,
    OAuthConnectionStatus,
    OAuthScopeTier,
    ProviderAccountHealthResponse,
    ProviderAccountsResponse,
    ProviderDisconnectResponse,
    ProviderHealth,
    ProviderKind,
    ProviderOAuthCallbackResponse,
    ProviderOAuthStartRequest,
    ProviderOAuthStartResponse,
    ProviderStatusResponse,
    ProviderSyncRequest,
    ProviderSyncResponse,
    ProviderWebhookResponse,
    RiskTier,
    ScopedIdentity,
    SecurityInspectionRequest,
    SecurityInspectionResponse,
    SessionResponse,
    TelegramBindingStatusResponse,
    TelegramProvenanceEvent,
    TelegramSetupRequest,
    TelegramSetupResponse,
    TelegramTestMessageRequest,
    TelegramTestMessageResponse,
    TelegramWebhookResponse,
    TodayResponse,
    WorkdayBriefResponse,
    WorkdayCalendarResponse,
    WorkdayFollowUpsResponse,
    WorkdayInboxResponse,
    WorkdayRegenerateRequest,
    WorkdayRegenerateResponse,
    WorkdaySnapshot,
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
        self.providers = operational.providers
        self.queue = operational.queue
        self.scheduler = operational.scheduler
        self.sessions = operational.sessions
        self.identity = build_identity_provider(settings)
        self.brain = build_brain_client(settings)
        self.oauth = ProviderOAuthClient(settings)
        self.policy = AssistantActionPolicyEngine()
        self.sanitizer = HtmlContentSanitizer()
        self.firewall = BasicInstructionFirewall()
        self.observability = InMemoryObservabilityProvider()
        self.workday = WorkdayLoopProcessor(brain=self.brain, providers=self.providers)


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

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        sanitized_errors = [
            {
                "loc": list(error.get("loc", [])),
                "msg": str(error.get("msg", "Invalid request.")),
                "type": str(error.get("type", "value_error")),
            }
            for error in exc.errors()
        ]
        container.observability.increment(
            "request_validation_error",
            {"path": request.url.path},
        )
        return JSONResponse(status_code=422, content={"detail": sanitized_errors})

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
        checks = dependency_checks(settings)
        brain_available = await container.brain.check_available()
        checks["onebrain"] = "ok" if brain_available else "unavailable"
        # Ready must mean writes will actually land: verify the assistant's write
        # vocabulary against what OneBrain advertises, so contract drift degrades
        # readiness instead of surfacing later as 422s on every workday write.
        checks["onebrain_contract"] = (
            write_contract_status(await container.brain.capabilities())
            if brain_available
            else "unavailable"
        )
        degraded = not brain_available or any(
            status.startswith("error") for status in checks.values()
        )
        return HealthResponse(
            service=settings.service_name,
            status="degraded" if degraded else "ok",
            version=__version__,
            degraded=degraded,
            checks={"api": "ok", **checks},
            correlation_id=current_request_id(),
        )

    @app.get("/metrics")
    async def metrics():
        return metrics_response()

    @app.get("/v1/today", response_model=TodayResponse)
    async def today(
        principal: AuthPrincipal = Depends(require_principal),
    ) -> TodayResponse:
        snapshot = await build_workday_snapshot(container, scope=principal.scope)
        return workday_snapshot_to_today_response(snapshot)

    @app.get("/v1/workday/today", response_model=WorkdaySnapshot)
    async def workday_today(
        principal: AuthPrincipal = Depends(require_principal),
        local_date: str | None = Query(default=None),
    ) -> WorkdaySnapshot:
        return await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=local_date,
        )

    @app.get("/v1/workday/brief", response_model=WorkdayBriefResponse)
    async def workday_brief(
        principal: AuthPrincipal = Depends(require_principal),
        local_date: str | None = Query(default=None),
    ) -> WorkdayBriefResponse:
        snapshot = await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=local_date,
        )
        return WorkdayBriefResponse(
            brief=snapshot.brief,
            partial_state=snapshot.partial_state,
        )

    @app.get("/v1/workday/inbox", response_model=WorkdayInboxResponse)
    async def workday_inbox(
        principal: AuthPrincipal = Depends(require_principal),
        local_date: str | None = Query(default=None),
    ) -> WorkdayInboxResponse:
        snapshot = await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=local_date,
        )
        return WorkdayInboxResponse(
            items=snapshot.inbox,
            partial_state=snapshot.partial_state,
        )

    @app.get("/v1/workday/follow-ups", response_model=WorkdayFollowUpsResponse)
    async def workday_follow_ups(
        principal: AuthPrincipal = Depends(require_principal),
        local_date: str | None = Query(default=None),
    ) -> WorkdayFollowUpsResponse:
        snapshot = await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=local_date,
        )
        return WorkdayFollowUpsResponse(
            risks=snapshot.follow_ups,
            partial_state=snapshot.partial_state,
        )

    @app.get("/v1/workday/calendar", response_model=WorkdayCalendarResponse)
    async def workday_calendar(
        principal: AuthPrincipal = Depends(require_principal),
        local_date: str | None = Query(default=None),
    ) -> WorkdayCalendarResponse:
        snapshot = await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=local_date,
        )
        return WorkdayCalendarResponse(
            insights=snapshot.calendar,
            partial_state=snapshot.partial_state,
        )

    @app.post("/v1/workday/regenerate", response_model=WorkdayRegenerateResponse)
    async def workday_regenerate(
        request: WorkdayRegenerateRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> WorkdayRegenerateResponse:
        snapshot = await build_workday_snapshot(
            container,
            scope=principal.scope,
            local_date=request.local_date,
        )
        return WorkdayRegenerateResponse(
            status="generated" if snapshot.partial_state.durable else "degraded",
            detail=(
                "Workday snapshot generated and stored in OneBrain."
                if snapshot.partial_state.durable
                else "Workday snapshot generated as degraded ephemeral output."
            ),
            snapshot=snapshot,
        )

    @app.post("/v1/actions", response_model=ActionRecord, status_code=201)
    async def create_action(
        request: ActionCreateRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ActionRecord:
        action = container.actions.create(request.model_copy(update={"scope": principal.scope}))
        container.observability.increment(
            "action_proposed",
            {"risk_tier": str(action.risk_tier), "action_type": action.action_type},
        )
        return action

    @app.post("/v1/actions/{action_id}/approve", response_model=ActionRecord)
    async def approve_action(
        action_id: UUID,
        request: ActionApprovalRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ActionRecord:
        action = container.actions.get(action_id)
        if action is None:
            raise HTTPException(status_code=404, detail="Action not found")
        require_scope_match(principal, action.scope)
        actor = principal.scope.user_id

        channel = ApprovalChannel.fresh_auth if request.fresh_auth else request.channel
        decision = container.policy.evaluate(
            action,
            channel=channel,
            fresh_auth=request.fresh_auth,
            onebrain_available=await container.brain.check_available(),
        )
        if not decision.allowed:
            raise HTTPException(status_code=409, detail=decision.model_dump(mode="json"))

        payload_ref = f"onebrain://action/{action.action_id}/approved-snapshot"
        approve_with_outbox = getattr(container.actions, "approve_with_outbox", None)
        try:
            if action.external_side_effect and approve_with_outbox is not None:
                approved, _ = approve_with_outbox(
                    action.action_id,
                    actor,
                    channel,
                    decision.reason,
                    "action.execution.requested",
                    payload_ref,
                )
            else:
                approved = container.actions.approve(
                    action.action_id,
                    actor=actor,
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
        await _record_action_audit(container, approved, decision)
        return approved

    @app.post("/v1/brain/records", response_model=BrainRecordResponse, status_code=201)
    async def create_brain_record(
        request: BrainRecordCreateRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> BrainRecordResponse:
        try:
            record = await container.brain.create_assistant_record(
                content=request.content,
                title=request.title,
                record_type=request.record_type,
                intent=request.intent,
                source=request.source,
                source_ref=request.source_ref,
                purpose=request.purpose,
                account_id=principal.scope.account_id,
                space_id=principal.scope.space_id,
                metadata=request.metadata,
                provenance=request.provenance,
                retention=request.retention,
            )
        except OneBrainClientError as exc:
            raise _onebrain_http_exception(exc) from exc
        container.observability.increment(
            "onebrain_record_created",
            {"record_type": request.record_type, "purpose": request.purpose},
        )
        return BrainRecordResponse(record=record)

    @app.get("/v1/brain/records", response_model=BrainRecordListResponse)
    async def list_brain_records(
        principal: AuthPrincipal = Depends(require_principal),
        purpose: str = Query(..., min_length=1),
        record_type: str = "",
        intent: str = "",
        status: str = "",
        limit: int = 50,
    ) -> BrainRecordListResponse:
        try:
            records = await container.brain.list_assistant_records(
                account_id=principal.scope.account_id,
                space_id=principal.scope.space_id,
                record_type=record_type,
                intent=intent,
                purpose=purpose,
                status=status,
                limit=limit,
            )
        except OneBrainClientError as exc:
            raise _onebrain_http_exception(exc) from exc
        return BrainRecordListResponse(records=records)

    @app.get("/v1/brain/records/{record_id}", response_model=BrainRecordResponse)
    async def get_brain_record(
        record_id: str,
        principal: AuthPrincipal = Depends(require_principal),
        purpose: str = Query(..., min_length=1),
    ) -> BrainRecordResponse:
        try:
            record = await container.brain.get_assistant_record(
                record_id,
                account_id=principal.scope.account_id,
                space_id=principal.scope.space_id,
                purpose=purpose,
            )
        except OneBrainClientError as exc:
            raise _onebrain_http_exception(exc) from exc
        return BrainRecordResponse(record=record)

    @app.post("/v1/brain/audit", response_model=BrainAuditEventResponse, status_code=201)
    async def create_brain_audit_event(
        request: BrainAuditEventRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> BrainAuditEventResponse:
        try:
            event = await container.brain.record_audit_event(
                action=request.action,
                target_type=request.target_type,
                target_id=request.target_id,
                account_id=principal.scope.account_id,
                space_id=principal.scope.space_id,
                purpose=request.purpose,
                decision=request.decision,
                metadata=request.metadata,
            )
        except OneBrainClientError as exc:
            raise _onebrain_http_exception(exc) from exc
        container.observability.increment("onebrain_audit_recorded", {"action": request.action})
        return BrainAuditEventResponse(event=event)

    @app.get("/v1/providers", response_model=ProviderStatusResponse)
    async def provider_status(
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderStatusResponse:
        return ProviderStatusResponse(
            providers=container.oauth.provider_statuses(),
            accounts=[
                summarize_provider_account(account)
                for account in container.providers.list_accounts()
            ],
        )

    @app.get("/v1/providers/accounts", response_model=ProviderAccountsResponse)
    async def provider_accounts(
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderAccountsResponse:
        return ProviderAccountsResponse(
            accounts=[
                summarize_provider_account(account)
                for account in container.providers.list_accounts()
            ]
        )

    @app.post(
        "/v1/providers/oauth/{provider}/start",
        response_model=ProviderOAuthStartResponse,
    )
    async def provider_oauth_start(
        provider: ProviderKind,
        request: ProviderOAuthStartRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderOAuthStartResponse:
        config = container.oauth.configuration(provider)
        requested_scopes = scopes_for(
            provider,
            request.requested_scope_tier,
            request.requested_services,
        )
        if not config.configured:
            return ProviderOAuthStartResponse(
                provider=provider,
                configured=False,
                requested_scopes=requested_scopes,
                detail=f"{provider} OAuth credentials are not configured.",
            )

        state = new_oauth_state()
        attempt_scope = principal.scope
        attempt = OAuthConnectionAttemptRecord(
            scope=attempt_scope,
            provider=provider,
            state_hash=hash_oauth_state(state),
            requested_scope_tier=request.requested_scope_tier,
            requested_scopes=requested_scopes,
            requested_services=request.requested_services,
            redirect_uri=config.redirect_uri,
            expires_at=oauth_attempt_expiry(),
        )
        container.providers.create_oauth_attempt(attempt)
        authorization_url = container.oauth.authorization_url(provider, state, requested_scopes)
        container.observability.increment("provider_oauth_started", {"provider": str(provider)})
        return ProviderOAuthStartResponse(
            provider=provider,
            connection_id=attempt.connection_id,
            authorization_url=authorization_url,
            configured=True,
            requested_scopes=requested_scopes,
            expires_at=attempt.expires_at,
            detail="OAuth connection started.",
        )

    @app.get(
        "/v1/providers/oauth/{provider}/callback",
        response_model=ProviderOAuthCallbackResponse,
    )
    async def provider_oauth_callback(
        provider: ProviderKind,
        code: str = Query(default=""),
        state: str = Query(default=""),
        error: str = Query(default=""),
        error_description: str = Query(default=""),
    ) -> ProviderOAuthCallbackResponse:
        attempt = container.providers.get_oauth_attempt_by_state(hash_oauth_state(state))
        if attempt is None or ProviderKind(attempt.provider) != provider:
            raise HTTPException(status_code=400, detail="Invalid OAuth state.")
        if OAuthConnectionStatus(attempt.status) == OAuthConnectionStatus.expired:
            raise HTTPException(status_code=400, detail="OAuth state expired.")
        if error:
            container.providers.update_oauth_attempt(
                attempt.connection_id,
                OAuthConnectionStatus.cancelled,
                error_description or error,
            )
            return ProviderOAuthCallbackResponse(
                provider=provider,
                status=OAuthConnectionStatus.cancelled,
                detail="OAuth connection cancelled by provider.",
                redirect_to="/settings/providers",
            )
        if not code:
            container.providers.update_oauth_attempt(
                attempt.connection_id,
                OAuthConnectionStatus.failed,
                "Missing authorization code.",
            )
            raise HTTPException(status_code=400, detail="Missing authorization code.")

        try:
            token_payload = await container.oauth.exchange_code(provider, code)
        except OAuthExchangeError as exc:
            container.providers.update_oauth_attempt(
                attempt.connection_id,
                OAuthConnectionStatus.failed,
                str(exc),
            )
            raise HTTPException(status_code=502, detail="Provider token exchange failed.") from exc

        token_secret_ref = container.secrets.store_secret(
            json.dumps(token_payload),
            f"{provider}-oauth-token",
        )
        granted_scopes = token_scopes(provider, token_payload)
        account = container.providers.upsert_account(
            scope=attempt.scope,
            provider=provider,
            provider_subject=token_subject(provider, token_payload),
            email=token_email(provider, token_payload),
            display_name=token_display_name(provider, token_payload),
            granted_scopes=granted_scopes,
            scope_tier=OAuthScopeTier(attempt.requested_scope_tier),
            refresh_token_secret_ref=token_secret_ref,
            token_expires_at=token_expires_at(token_payload),
        )
        container.providers.update_oauth_attempt(
            attempt.connection_id,
            OAuthConnectionStatus.completed,
        )
        onebrain_recorded = await _record_provider_connected(container, account)
        if onebrain_recorded:
            sync_job = container.providers.enqueue_sync_job(container.queue, account, "initial")
            container.providers.enqueue_subscription_job(container.queue, account, "setup")
            detail = f"Connected {account.display_name}; initial sync queued as {sync_job.job_id}."
        else:
            account = container.providers.mark_sync_degraded(
                account.provider_account_id,
                "OneBrain provenance is unavailable; provider sync is paused.",
            )
            detail = (
                "Provider token stored, but sync is paused until OneBrain provenance "
                "is available."
            )
        container.observability.increment("provider_oauth_completed", {"provider": str(provider)})
        return ProviderOAuthCallbackResponse(
            provider=provider,
            status=OAuthConnectionStatus.completed,
            provider_account_id=account.provider_account_id,
            detail=detail,
            redirect_to="/settings/providers",
        )

    @app.post(
        "/v1/providers/accounts/{account_id}/disconnect",
        response_model=ProviderDisconnectResponse,
    )
    async def provider_disconnect(
        account_id: UUID,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderDisconnectResponse:
        account = container.providers.get_account(account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Provider account not found.")
        require_scope_match(principal, account.scope)
        try:
            container.secrets.revoke_secret(account.refresh_token_secret_ref)
        except Exception:
            container.observability.increment(
                "provider_secret_revoke_failed",
                {"provider": str(account.provider)},
            )
        disconnected = container.providers.disconnect_account(account_id)
        await _record_provider_health(
            container,
            disconnected,
            "Provider account disconnected; sync jobs are paused.",
        )
        return ProviderDisconnectResponse(
            status=disconnected.status,
            detail="Provider account disconnected.",
        )

    @app.post(
        "/v1/providers/accounts/{account_id}/sync",
        response_model=ProviderSyncResponse,
        status_code=202,
    )
    async def provider_sync(
        account_id: UUID,
        request: ProviderSyncRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderSyncResponse:
        account = container.providers.get_account(account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Provider account not found.")
        require_scope_match(principal, account.scope)
        if str(account.status) == "disconnected":
            raise HTTPException(status_code=409, detail="Provider account is disconnected.")
        job = container.providers.enqueue_sync_job(container.queue, account, request.sync_kind)
        return ProviderSyncResponse(
            status="queued",
            detail="Read-only provider sync queued.",
            job=job,
        )

    @app.get(
        "/v1/providers/accounts/{account_id}/health",
        response_model=ProviderAccountHealthResponse,
    )
    async def provider_account_health(
        account_id: UUID,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> ProviderAccountHealthResponse:
        account = container.providers.get_account(account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Provider account not found.")
        require_scope_match(principal, account.scope)
        detail = account.last_sync_error or "Provider account is ready for read-only sync."
        return ProviderAccountHealthResponse(
            provider_account_id=account.provider_account_id,
            provider=account.provider,
            status=account.status,
            sync_state=account.sync_state,
            detail=detail,
            last_sync_at=account.last_sync_at,
            last_sync_error=account.last_sync_error,
            last_sync_status=account.last_sync_status,
            last_sync_error_class=account.last_sync_error_class,
            retry_after=account.retry_after,
            stale_since=account.stale_since,
            last_status_detail=account.last_status_detail,
        )

    @app.post("/v1/providers/webhooks/google", response_model=ProviderWebhookResponse)
    async def google_provider_webhook(
        request: Request,
        payload: dict[str, object],
    ) -> ProviderWebhookResponse:
        return await _handle_provider_webhook(container, ProviderKind.google, request, payload)

    @app.post("/v1/providers/webhooks/microsoft")
    async def microsoft_provider_webhook(
        request: Request,
        payload: dict[str, object] | None = None,
        validationToken: str = Query(default=""),
    ):
        if validationToken:
            return PlainTextResponse(validationToken)
        return await _handle_provider_webhook(
            container,
            ProviderKind.microsoft,
            request,
            payload or {},
        )

    @app.post("/v1/security/inspect", response_model=SecurityInspectionResponse)
    async def inspect_untrusted_content(
        request: SecurityInspectionRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> SecurityInspectionResponse:
        sanitized = container.sanitizer.sanitize_html(request.html)
        firewall = container.firewall.inspect(sanitized, request.source_ref)
        return SecurityInspectionResponse(sanitized=sanitized, firewall=firewall)

    @app.post("/v1/telegram/setup", response_model=TelegramSetupResponse, status_code=201)
    async def telegram_setup(
        request: TelegramSetupRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> TelegramSetupResponse:
        setup = container.telegram.create_setup(
            request.model_copy(update={"scope": principal.scope})
        )
        container.observability.increment("telegram_setup", {"status": str(setup.status)})
        return setup

    @app.get(
        "/v1/telegram/bindings/{binding_id}",
        response_model=TelegramBindingStatusResponse,
    )
    async def telegram_binding_status(
        binding_id: UUID,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> TelegramBindingStatusResponse:
        _require_binding_scope(container, binding_id, principal)
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
        binding_id: UUID,
        request: TelegramTestMessageRequest,
        principal: AuthPrincipal = Depends(require_principal),
    ) -> TelegramTestMessageResponse:
        _require_binding_scope(container, binding_id, principal)
        try:
            queued = container.telegram.queue_test_message(binding_id, request, container.outbox)
        except TelegramBindingNotFound as exc:
            raise HTTPException(status_code=404, detail="Telegram binding not found") from exc
        except TelegramBindingNotReady as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        container.observability.increment("telegram_test_message", {"status": queued.status})
        await _record_telegram_event_by_ref(container, queued.event_ref)
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
        if result.status != "duplicate" and result.event_ref:
            await _record_telegram_event_by_ref(container, result.event_ref)
        return result

    @app.post("/v1/auth/login", response_model=LoginResponse)
    async def login(request: LoginRequest) -> LoginResponse:
        # Minting is delegated to the identity authority (OneBrain). Until it is
        # reachable, the OneBrain provider raises and login fails closed with 503.
        try:
            resolved = await container.identity.resolve_login(request)
        except IdentityAuthorityUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if resolved is None:
            container.observability.increment("auth_login", {"status": "rejected"})
            raise HTTPException(status_code=401, detail="Login failed.")
        token, record = mint_session(
            container.sessions,
            scope=resolved.to_scope(),
            identity_source=resolved.identity_source,
            ttl_seconds=settings.auth_session_ttl_seconds,
        )
        container.observability.increment(
            "auth_login",
            {"status": "ok", "identity_source": resolved.identity_source},
        )
        return LoginResponse(
            access_token=token,
            session_id=record.session_id,
            scope=record.scope,
            identity_source=record.identity_source,
            expires_at=record.expires_at,
        )

    @app.post("/v1/auth/logout", response_model=LogoutResponse)
    async def logout(
        principal: AuthPrincipal = Depends(require_principal),
    ) -> LogoutResponse:
        container.sessions.revoke_session(principal.session_id)
        container.observability.increment("auth_logout", {"status": "ok"})
        return LogoutResponse()

    @app.get("/v1/auth/session", response_model=SessionResponse)
    async def session_info(
        principal: AuthPrincipal = Depends(require_principal),
    ) -> SessionResponse:
        return SessionResponse(
            session_id=principal.session_id,
            scope=principal.scope,
            identity_source=principal.identity_source,
            expires_at=principal.expires_at,
            last_used_at=principal.last_used_at,
        )

    return app


async def build_workday_snapshot(
    container: RuntimeContainer,
    *,
    scope: ScopedIdentity,
    local_date: str | None = None,
) -> WorkdaySnapshot:
    onebrain_available = await container.brain.check_available()
    return await container.workday.generate_snapshot(
        scope=scope,
        local_date=local_date,
        provider_health=_provider_health(container, onebrain_available),
        approvals=_approval_cards(container, scope),
    )


def _require_binding_scope(
    container: RuntimeContainer,
    binding_id: UUID,
    principal: AuthPrincipal,
) -> None:
    """Telegram bindings are account-scoped; do not leak other accounts' bindings."""
    record = container.telegram.bindings.get(binding_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Telegram binding not found")
    require_scope_match(principal, record.scope)


def _provider_health(container: RuntimeContainer, onebrain_available: bool) -> list[ProviderHealth]:
    settings = container.settings
    checks = dependency_checks(settings)
    return [
        ProviderHealth(
            provider="OneBrain",
            status="ok" if onebrain_available else "degraded",
            detail=settings.onebrain_api_base_url,
        ),
        ProviderHealth(
            provider="Postgres",
            status=_provider_status(checks["postgres_schema"]),
            detail="Operational store",
        ),
        ProviderHealth(
            provider="Redis",
            status=_provider_status(checks["redis"]),
            detail="Queue wakeups and scheduler",
        ),
        ProviderHealth(
            provider="Telegram",
            status="binding-ready",
            detail="NotificationChannel setup and webhook binding boundary",
        ),
        ProviderHealth(
            provider="Google",
            status="configured" if settings.google_oauth_configured else "not-configured",
            detail="Gmail and Google Calendar OAuth",
        ),
        ProviderHealth(
            provider="Microsoft",
            status="configured" if settings.microsoft_oauth_configured else "not-configured",
            detail="Outlook and Microsoft Calendar OAuth",
        ),
    ]


_APPROVAL_PENDING_STATES = frozenset({ActionState.proposed, ActionState.needs_review})


def _approval_cards(container: RuntimeContainer, scope: ScopedIdentity) -> list[ApprovalCard]:
    """Surface real actions awaiting approval for this scope.

    No fabricated cards: an empty list means nothing is pending. Filtering happens in
    Python for the current single-operator volume; a scoped store query is the scale path.
    """
    cards: list[ApprovalCard] = []
    for action in container.actions.all():
        if ActionState(action.state) not in _APPROVAL_PENDING_STATES:
            continue
        if (
            action.scope.account_id != scope.account_id
            or action.scope.space_id != scope.space_id
        ):
            continue
        cards.append(_approval_card_from_action(action))
    return cards


def _approval_card_from_action(action: ActionRecord) -> ApprovalCard:
    return ApprovalCard(
        action_id=str(action.action_id),
        action_type=action.action_type,
        risk_tier=RiskTier(action.risk_tier),
        summary=action.summary,
        sending_account=action.sending_account_ref or "",
        recipient_refs=action.recipient_refs,
        source_ref=action.source_refs[0] if action.source_refs else "",
        changed_fields=action.changed_fields,
        sensitive_flags=action.sensitive_flags,
        approval_reason=action.approval_reason,
        reversible=action.reversible,
        primary_channel="web"
        if RiskTier(action.risk_tier) == RiskTier.high
        else "web_or_telegram",
    )


async def _record_provider_connected(
    container: RuntimeContainer,
    account,
) -> bool:
    try:
        await record_provider_account_connected(container.brain, account)
        await record_provider_scope_grant(container.brain, account)
        await record_provider_health_event(
            container.brain,
            account,
            "Provider account connected; initial read-only sync queued.",
        )
        return True
    except OneBrainClientError:
        container.observability.increment(
            "onebrain_provider_connection_failed",
            {"provider": str(account.provider)},
        )
        return False


async def _record_provider_health(container: RuntimeContainer, account, detail: str) -> None:
    try:
        await record_provider_health_event(container.brain, account, detail)
    except OneBrainClientError:
        container.observability.increment(
            "onebrain_provider_health_failed",
            {"provider": str(account.provider)},
        )


def _verify_provider_webhook(
    provider: ProviderKind,
    request: Request,
    payload: dict[str, object],
    settings: Settings,
) -> bool:
    """Verify a provider push actually came from the provider we subscribed with.

    Google echoes the channel token we set at watch-creation time in the
    X-Goog-Channel-Token header; Microsoft echoes our clientState in every
    notification. Both are compared constant-time and fail closed, so an
    unauthenticated caller can no longer trigger reconcile sync storms.

    NOTE: real watch/subscription creation must set these tokens
    (settings.google_webhook_verification_token / microsoft_webhook_client_state);
    the current provider layer is a skeleton, so no live webhooks exist yet.
    """
    if provider == ProviderKind.google:
        return constant_time_secret_matches(
            request.headers.get("x-goog-channel-token"),
            settings.google_webhook_verification_token,
        )
    values = payload.get("value")
    if not isinstance(values, list) or not values:
        return False
    return all(
        isinstance(item, dict)
        and constant_time_secret_matches(
            item.get("clientState") if isinstance(item.get("clientState"), str) else None,
            settings.microsoft_webhook_client_state,
        )
        for item in values
    )


async def _handle_provider_webhook(
    container: RuntimeContainer,
    provider: ProviderKind,
    request: Request,
    payload: dict[str, object],
) -> ProviderWebhookResponse:
    if not _verify_provider_webhook(provider, request, payload, container.settings):
        container.observability.increment("provider_webhook_rejected", {"provider": str(provider)})
        raise HTTPException(status_code=401, detail="Invalid provider webhook verification.")
    dedupe_key = _provider_webhook_dedupe_key(provider, request, payload)
    first_seen = container.providers.remember_webhook_event(provider, dedupe_key)
    if not first_seen:
        return ProviderWebhookResponse(
            provider=provider,
            status="duplicate",
            detail="Provider webhook already processed.",
            deduplicated=True,
        )

    jobs = []
    for account in container.providers.list_accounts():
        if ProviderKind(account.provider) != provider or str(account.status) == "disconnected":
            continue
        jobs.append(container.providers.enqueue_sync_job(container.queue, account, "reconcile"))
    container.observability.increment(
        "provider_webhook_received",
        {"provider": str(provider), "jobs": str(len(jobs))},
    )
    return ProviderWebhookResponse(
        provider=provider,
        status="queued" if jobs else "accepted",
        detail=(
            "Provider webhook accepted and reconciliation queued."
            if jobs
            else "Provider webhook accepted; no connected account matched."
        ),
        job=jobs[0] if jobs else None,
    )


def _provider_webhook_dedupe_key(
    provider: ProviderKind,
    request: Request,
    payload: dict[str, object],
) -> str:
    if provider == ProviderKind.google:
        header_key = request.headers.get("x-goog-message-number") or request.headers.get(
            "x-goog-channel-id"
        )
        if header_key:
            return header_key
        message = payload.get("message")
        if isinstance(message, dict) and message.get("messageId"):
            return str(message["messageId"])
    else:
        values = payload.get("value")
        if isinstance(values, list) and values:
            first = values[0]
            if isinstance(first, dict):
                return ":".join(
                    str(first.get(key, ""))
                    for key in ("subscriptionId", "resource", "changeType")
                )
    return f"{provider}:{current_request_id()}"


async def _record_action_audit(
    container: RuntimeContainer,
    action: ActionRecord,
    decision,
) -> None:
    try:
        await container.brain.record_action_audit(action, decision)
    except OneBrainClientError:
        container.observability.increment(
            "onebrain_action_audit_failed",
            {"action_type": action.action_type, "risk_tier": str(action.risk_tier)},
        )


async def _record_telegram_event_by_ref(container: RuntimeContainer, event_ref: str) -> None:
    event = container.telegram.get_event(event_ref)
    if event is None:
        container.observability.increment("telegram_provenance_missing", {"event_ref": "missing"})
        return
    await _record_telegram_event(container, event)


async def _record_telegram_event(
    container: RuntimeContainer,
    event: TelegramProvenanceEvent,
) -> None:
    try:
        record = await record_telegram_event(container.brain, event)
    except OneBrainClientError:
        container.observability.increment(
            "onebrain_telegram_event_failed",
            {"event_type": event.event_type},
        )
        return
    container.observability.increment(
        "onebrain_telegram_event_recorded",
        {
            "event_type": event.event_type,
            "record_type": str(record.get("record_type", "unknown")),
        },
    )


def _onebrain_http_exception(exc: OneBrainClientError) -> HTTPException:
    status_code = exc.status_code if exc.status_code and exc.status_code >= 400 else 503
    if status_code >= 500:
        detail = "OneBrain is unavailable."
    else:
        detail = exc.detail
    return HTTPException(status_code=status_code, detail=detail)


def _provider_status(check: str) -> str:
    if check == "ok":
        return "ok"
    if check in {"memory", "not_required"}:
        return "local"
    if check.startswith("error"):
        return "degraded"
    return "configured"


def _degraded_reason(onebrain_available: bool, dependency_errors: dict[str, str]) -> str:
    if not onebrain_available:
        return "OneBrain unavailable"
    return "Operational dependency unavailable: " + ", ".join(sorted(dependency_errors))
