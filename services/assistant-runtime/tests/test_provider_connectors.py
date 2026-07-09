from __future__ import annotations

import asyncio
import json
from datetime import timedelta
from uuid import UUID

import httpx
from conftest import authed_client
from fastapi.testclient import TestClient

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.domain.providers import InMemoryProviderStore, summarize_provider_account
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.providers.oauth import (
    GOOGLE_CALENDAR_READONLY,
    GOOGLE_GMAIL_READONLY,
    MICROSOFT_CALENDARS_READ,
    MICROSOFT_MAIL_READ,
    scopes_for,
)
from assistant_runtime.providers.onebrain import DisabledBrainClient
from assistant_runtime.providers.read_adapters import ProviderReadClient
from assistant_runtime.providers.token_refresh import (
    ProviderTokenRefresher,
    ProviderTokenRefreshError,
)
from assistant_runtime.schemas import (
    JobState,
    OAuthScopeTier,
    ProviderAccountStatus,
    ProviderKind,
    ProviderService,
    ScopedIdentity,
    utc_now,
)
from assistant_runtime.worker.runner import AssistantWorker


def _settings(**overrides):
    values = {
        "ONEBRAIN_CLIENT_MODE": "memory",
        "ONEBRAIN_AVAILABLE": True,
        "GOOGLE_OAUTH_CLIENT_ID": "google-client",
        "GOOGLE_OAUTH_CLIENT_SECRET": "google-secret",
        "MICROSOFT_OAUTH_CLIENT_ID": "microsoft-client",
        "MICROSOFT_OAUTH_CLIENT_SECRET": "microsoft-secret",
        **overrides,
    }
    return Settings(**values)


def _client(**overrides) -> TestClient:
    return authed_client(create_app(_settings(**overrides)))


def test_provider_status_reports_missing_configuration_without_breaking_local_dev() -> None:
    app = create_app(
        Settings(
            ONEBRAIN_CLIENT_MODE="memory",
            GOOGLE_OAUTH_CLIENT_ID="",
            GOOGLE_OAUTH_CLIENT_SECRET="",
            MICROSOFT_OAUTH_CLIENT_ID="",
            MICROSOFT_OAUTH_CLIENT_SECRET="",
        )
    )
    client = authed_client(app)

    response = client.get("/v1/providers")

    assert response.status_code == 200
    body = response.json()
    assert body["accounts"] == []
    assert {provider["provider"]: provider["configured"] for provider in body["providers"]} == {
        "google": False,
        "microsoft": False,
    }


def test_google_oauth_start_builds_read_only_authorization_url() -> None:
    client = _client()

    response = client.post("/v1/providers/oauth/google/start", json={})

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert body["connection_id"]
    assert "accounts.google.com/o/oauth2/v2/auth" in body["authorization_url"]
    assert GOOGLE_GMAIL_READONLY in body["requested_scopes"]
    assert GOOGLE_CALENDAR_READONLY in body["requested_scopes"]
    assert "google-secret" not in str(body)


def test_microsoft_oauth_start_builds_read_only_authorization_url() -> None:
    client = _client(MICROSOFT_TENANT_ID="organizations")

    response = client.post("/v1/providers/oauth/microsoft/start", json={})

    assert response.status_code == 200
    body = response.json()
    assert "login.microsoftonline.com/organizations" in body["authorization_url"]
    assert MICROSOFT_MAIL_READ in body["requested_scopes"]
    assert MICROSOFT_CALENDARS_READ in body["requested_scopes"]


def test_oauth_callback_stores_token_by_secret_ref_and_queues_provider_jobs() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]

    response = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_code"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["provider_account_id"]
    assert "local-refresh" not in str(body)

    accounts = app.state.container.providers.list_accounts()
    jobs = app.state.container.queue.all()
    records = list(app.state.container.brain.records.values())

    assert len(accounts) == 1
    assert accounts[0].refresh_token_secret_ref.startswith("secret://assistant/google-oauth-token/")
    assert "local-refresh" not in accounts[0].refresh_token_secret_ref
    assert app.state.container.secrets.retrieve_secret(accounts[0].refresh_token_secret_ref)
    assert {job.job_type for job in jobs} == {
        "provider.sync.initial",
        "provider.subscription.setup",
    }
    assert any(record["record_type"] == "provider_account" for record in records)
    assert any(record["record_type"] == "scope_grant" for record in records)
    assert all("local-refresh" not in str(record) for record in records)


def test_oauth_callback_pauses_sync_when_onebrain_provenance_is_unavailable() -> None:
    app = create_app(_settings(ONEBRAIN_AVAILABLE=False))
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]

    response = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_no_onebrain"},
    )

    assert response.status_code == 200
    assert "sync is paused" in response.json()["detail"]
    accounts = app.state.container.providers.list_accounts()
    jobs = app.state.container.queue.all()

    assert len(accounts) == 1
    assert accounts[0].status == "degraded"
    assert accounts[0].sync_state == "degraded"
    assert (
        accounts[0].last_sync_error
        == "OneBrain provenance is unavailable; provider sync is paused."
    )
    assert jobs == []


def test_oauth_callback_rejects_state_replay_and_mismatch() -> None:
    client = _client()

    response = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": "not-real", "code": "test_google_code"},
    )

    assert response.status_code == 400
    assert "Invalid OAuth state" in response.text


def test_provider_webhook_deduplicates_and_enqueues_reconciliation() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_webhook"},
    )

    first = client.post(
        "/v1/providers/webhooks/google",
        json={"message": {"messageId": "msg-1"}},
        headers={"X-Goog-Message-Number": "message-1"},
    )
    duplicate = client.post(
        "/v1/providers/webhooks/google",
        json={"message": {"messageId": "msg-1"}},
        headers={"X-Goog-Message-Number": "message-1"},
    )

    assert first.status_code == 200
    assert first.json()["status"] == "queued"
    assert duplicate.status_code == 200
    assert duplicate.json()["deduplicated"] is True
    assert duplicate.json()["status"] == "duplicate"


def test_microsoft_validation_token_returns_plain_text() -> None:
    client = _client()

    response = client.post(
        "/v1/providers/webhooks/microsoft",
        params={"validationToken": "plain-validation-token"},
        json={},
    )

    assert response.status_code == 200
    assert response.text == "plain-validation-token"
    assert response.headers["content-type"].startswith("text/plain")


def test_google_read_adapter_maps_gmail_and_calendar_payloads() -> None:
    account = _provider_account(ProviderKind.google)
    reader = ProviderReadClient(transport=httpx.MockTransport(_google_read_handler))

    result = asyncio.run(
        reader.fetch_sources(
            account,
            {"access_token": "live-google-token"},
            local_date="2026-07-09",
        )
    )

    assert result.live is True
    assert result.messages[0].subject == "Live client reply"
    assert result.messages[0].sender == "Client <client@example.com>"
    assert {"needs_reply", "client", "priority"}.issubset(set(result.messages[0].flags))
    assert result.calendar_events[0].title == "Live board sync"
    assert result.calendar_events[0].attendee_count == 2
    assert "prep_needed" in result.calendar_events[0].flags


def test_microsoft_read_adapter_maps_graph_payloads() -> None:
    account = _provider_account(ProviderKind.microsoft)
    reader = ProviderReadClient(transport=httpx.MockTransport(_microsoft_read_handler))

    result = asyncio.run(
        reader.fetch_sources(
            account,
            {"access_token": "live-microsoft-token"},
            local_date="2026-07-09",
        )
    )

    assert result.live is True
    assert result.messages[0].subject == "Graph client reply"
    assert result.messages[0].sender == "client@example.com"
    assert "needs_reply" in result.messages[0].flags
    assert result.calendar_events[0].title == "Graph board sync"
    assert result.calendar_events[0].has_meeting_link is True


def test_google_token_refresher_rotates_expiring_token_payload() -> None:
    app = create_app(_settings())
    account = _store_provider_account(
        app,
        ProviderKind.google,
        "old-google-token",
        refresh_token="google-refresh-token",
        token_expires_at=utc_now() - timedelta(minutes=1),
    )
    old_secret_ref = account.refresh_token_secret_ref
    refresher = ProviderTokenRefresher(
        _settings(),
        app.state.container.secrets,
        app.state.container.providers,
        transport=httpx.MockTransport(_google_refresh_handler),
    )

    result = asyncio.run(refresher.token_for_read(account))

    updated = app.state.container.providers.get_account(account.provider_account_id)
    assert result.refreshed is True
    assert result.token_payload["access_token"] == "rotated-google-token"
    assert result.token_payload["refresh_token"] == "rotated-google-refresh-token"
    assert updated is not None
    assert updated.refresh_token_secret_ref != old_secret_ref
    assert "rotated-google-token" in app.state.container.secrets.retrieve_secret(
        updated.refresh_token_secret_ref
    )


def test_microsoft_token_refresher_preserves_refresh_token_when_omitted() -> None:
    app = create_app(_settings(MICROSOFT_TENANT_ID="organizations"))
    account = _store_provider_account(
        app,
        ProviderKind.microsoft,
        "old-microsoft-token",
        refresh_token="microsoft-refresh-token",
        token_expires_at=utc_now() - timedelta(minutes=1),
    )
    refresher = ProviderTokenRefresher(
        _settings(MICROSOFT_TENANT_ID="organizations"),
        app.state.container.secrets,
        app.state.container.providers,
        transport=httpx.MockTransport(_microsoft_refresh_handler_without_refresh_token),
    )

    result = asyncio.run(refresher.token_for_read(account))

    assert result.refreshed is True
    assert result.token_payload["access_token"] == "rotated-microsoft-token"
    assert result.token_payload["refresh_token"] == "microsoft-refresh-token"


def test_local_token_payloads_skip_refresh_even_when_expiring() -> None:
    app = create_app(_settings())
    account = _store_provider_account(
        app,
        ProviderKind.google,
        "local-access-token",
        refresh_token="local-refresh-token",
        token_expires_at=utc_now() - timedelta(minutes=1),
    )

    def _fail_on_refresh(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected refresh call to {request.url}")

    refresher = ProviderTokenRefresher(
        _settings(),
        app.state.container.secrets,
        app.state.container.providers,
        transport=httpx.MockTransport(_fail_on_refresh),
    )

    result = asyncio.run(refresher.token_for_read(account))

    assert result.refreshed is False
    assert result.token_payload["access_token"] == "local-access-token"


def test_token_refresher_classifies_invalid_grant_as_auth_failure() -> None:
    app = create_app(_settings())
    account = _store_provider_account(
        app,
        ProviderKind.google,
        "old-google-token",
        refresh_token="revoked-google-refresh-token",
        token_expires_at=utc_now() - timedelta(minutes=1),
    )
    refresher = ProviderTokenRefresher(
        _settings(),
        app.state.container.secrets,
        app.state.container.providers,
        transport=httpx.MockTransport(_google_invalid_grant_handler),
    )

    try:
        asyncio.run(refresher.token_for_read(account))
    except ProviderTokenRefreshError as exc:
        assert exc.failure_class == "auth"
        assert exc.retryable is False
        assert "revoked-google-refresh-token" not in exc.detail
        return
    raise AssertionError("expected refresh failure")


def test_google_read_adapter_uses_gmail_history_cursor() -> None:
    account = _provider_account(ProviderKind.google)
    reader = ProviderReadClient(transport=httpx.MockTransport(_google_history_handler))

    result = asyncio.run(
        reader.fetch_sources(
            account,
            {"access_token": "live-google-token"},
            local_date="2026-07-09",
            cursors={"gmail_history": "123"},
        )
    )

    assert result.used_incremental is True
    assert result.messages[0].subject == "History client reply"
    assert result.cursor_updates["gmail_history"] == "456"
    assert "google_calendar_sync_token" in result.cursor_updates


def test_google_read_adapter_falls_back_when_gmail_history_expires() -> None:
    account = _provider_account(ProviderKind.google)
    reader = ProviderReadClient(
        transport=httpx.MockTransport(_google_history_expired_handler)
    )

    result = asyncio.run(
        reader.fetch_sources(
            account,
            {"access_token": "live-google-token"},
            local_date="2026-07-09",
            cursors={"gmail_history": "expired-history"},
        )
    )

    assert result.messages[0].subject == "Fallback client reply"
    assert result.cursor_updates["gmail_history"] == "789"
    assert result.fallback_reason is not None
    assert "expired" in result.fallback_reason


def test_microsoft_read_adapter_uses_delta_links() -> None:
    account = _provider_account(ProviderKind.microsoft)
    reader = ProviderReadClient(transport=httpx.MockTransport(_microsoft_delta_handler))

    result = asyncio.run(
        reader.fetch_sources(
            account,
            {"access_token": "live-microsoft-token"},
            local_date="2026-07-09",
            cursors={},
        )
    )

    assert result.used_incremental is True
    assert result.messages[0].subject == "Delta client reply"
    assert result.calendar_events[0].title == "Delta board sync"
    assert result.cursor_updates["microsoft_mail_delta_link"].endswith("mail-delta")
    assert result.cursor_updates["microsoft_calendar_delta_link"].endswith("calendar-next")


def test_worker_sync_writes_live_adapter_source_records_without_secret_leakage() -> None:
    app = create_app(_settings())
    account = _store_provider_account(app, ProviderKind.google, "live-google-token")
    app.state.container.providers.enqueue_sync_job(app.state.container.queue, account, "initial")
    worker = AssistantWorker(
        worker_id="provider-live-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
        provider_reader=ProviderReadClient(transport=httpx.MockTransport(_google_read_handler)),
    )

    result = worker.run_once()

    records = list(app.state.container.brain.records.values())
    source_records = [
        record
        for record in records
        if record["record_type"] in {"provider_message", "provider_calendar_event"}
    ]
    assert result.jobs_processed == 1
    assert app.state.container.providers.list_accounts()[0].sync_state == "healthy"
    assert {record["title"] for record in source_records} == {
        "Live client reply",
        "Live board sync",
    }
    assert all("live-google-token" not in str(record) for record in source_records)
    assert all("stored-refresh-token" not in str(record) for record in source_records)
    assert all("secret://" not in str(record) for record in source_records)


def test_worker_refreshes_token_before_sync_without_onebrain_token_leakage() -> None:
    app = create_app(_settings())
    account = _store_provider_account(
        app,
        ProviderKind.google,
        "old-google-token",
        refresh_token="google-refresh-token",
        token_expires_at=utc_now() - timedelta(minutes=1),
    )
    old_secret_ref = account.refresh_token_secret_ref
    app.state.container.providers.enqueue_sync_job(app.state.container.queue, account, "initial")
    transport = httpx.MockTransport(_rotated_google_sync_handler)
    worker = AssistantWorker(
        worker_id="provider-refresh-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
        provider_reader=ProviderReadClient(transport=transport),
        token_refresher=ProviderTokenRefresher(
            _settings(),
            app.state.container.secrets,
            app.state.container.providers,
            transport=transport,
        ),
    )

    result = worker.run_once()

    updated = app.state.container.providers.get_account(account.provider_account_id)
    source_records = [
        record
        for record in app.state.container.brain.records.values()
        if record["record_type"] in {"provider_message", "provider_calendar_event"}
    ]
    assert result.jobs_processed == 1
    assert updated is not None
    assert updated.refresh_token_secret_ref != old_secret_ref
    assert {record["title"] for record in source_records} == {
        "Rotated client reply",
        "Rotated board sync",
    }
    leaked_values = [
        "old-google-token",
        "rotated-google-token",
        "google-refresh-token",
        "rotated-google-refresh-token",
        old_secret_ref,
        updated.refresh_token_secret_ref,
    ]
    assert all(leaked not in str(source_records) for leaked in leaked_values)


def test_worker_sync_marks_throttled_retry_after_status_without_token_leakage() -> None:
    app = create_app(_settings())
    account = _store_provider_account(app, ProviderKind.microsoft, "live-throttled-token")
    app.state.container.providers.enqueue_sync_job(app.state.container.queue, account, "manual")
    worker = AssistantWorker(
        worker_id="provider-throttled-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
        provider_reader=ProviderReadClient(
            transport=httpx.MockTransport(_microsoft_retry_after_handler)
        ),
    )

    result = worker.run_once()

    updated = app.state.container.providers.get_account(account.provider_account_id)
    summary = summarize_provider_account(updated)
    records = list(app.state.container.brain.records.values())
    assert result.jobs_processed == 1
    assert updated is not None
    assert updated.sync_state == "degraded"
    assert updated.last_sync_status == "throttled"
    assert updated.last_sync_error_class == "throttled"
    assert updated.retry_after is not None
    assert summary.last_sync_status == "throttled"
    assert summary.retry_after == updated.retry_after
    assert all("live-throttled-token" not in str(record) for record in records)
    assert all("stored-refresh-token" not in str(record) for record in records)


def test_worker_sync_skips_when_retry_after_is_pending() -> None:
    app = create_app(_settings())
    account = _store_provider_account(app, ProviderKind.google, "live-google-token")
    account = app.state.container.providers.update_account_sync_status(
        account.provider_account_id,
        last_sync_status="throttled",
        last_status_detail="Provider sync is throttled.",
        last_sync_error_class="throttled",
        retry_after=utc_now() + timedelta(minutes=10),
        stale_since=utc_now(),
    )
    app.state.container.providers.enqueue_sync_job(app.state.container.queue, account, "manual")

    def _fail_on_read(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected provider read: {request.url}")

    worker = AssistantWorker(
        worker_id="provider-retry-after-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
        provider_reader=ProviderReadClient(transport=httpx.MockTransport(_fail_on_read)),
    )

    result = worker.run_once()

    updated = app.state.container.providers.get_account(account.provider_account_id)
    assert result.jobs_processed == 1
    assert updated is not None
    assert updated.last_sync_status == "throttled"
    assert updated.retry_after is not None
    assert "waiting for retry-after" in (updated.last_status_detail or "")


def test_worker_sync_degrades_on_live_read_failure_without_token_leakage() -> None:
    app = create_app(_settings())
    account = _store_provider_account(app, ProviderKind.microsoft, "live-failing-token")
    app.state.container.providers.enqueue_sync_job(app.state.container.queue, account, "initial")
    worker = AssistantWorker(
        worker_id="provider-failing-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
        provider_reader=ProviderReadClient(transport=httpx.MockTransport(_unauthorized_handler)),
    )

    result = worker.run_once()

    account = app.state.container.providers.list_accounts()[0]
    records = list(app.state.container.brain.records.values())
    assert result.jobs_processed == 1
    assert account.sync_state == "degraded"
    assert account.last_sync_error is not None
    assert "Provider live read failed" in account.last_sync_error
    assert any(record["record_type"] == "provider_message" for record in records)
    assert all("live-failing-token" not in str(record) for record in records)
    assert all("stored-refresh-token" not in str(record) for record in records)


def test_worker_processes_provider_sync_and_subscription_jobs() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/microsoft/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    callback = client.get(
        "/v1/providers/oauth/microsoft/callback",
        params={"state": state, "code": "test_microsoft_sync"},
    ).json()
    account_id = callback["provider_account_id"]
    worker = AssistantWorker(
        worker_id="provider-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=app.state.container.brain,
    )

    first = worker.run_once()
    second = worker.run_once()

    assert first.jobs_processed == 1
    assert second.jobs_processed == 1
    cursors = app.state.container.providers.list_cursors()
    subscriptions = app.state.container.providers.list_subscriptions()
    account = app.state.container.providers.get_account(UUID(account_id))
    records = list(app.state.container.brain.records.values())

    assert account is not None
    assert account.sync_state == "healthy"
    assert {cursor.cursor_kind for cursor in cursors} == {
        "microsoft_mail_delta_link",
        "microsoft_calendar_delta_link",
    }
    assert {subscription.subscription_kind for subscription in subscriptions} == {
        "microsoft_mail_change_notification",
        "microsoft_calendar_change_notification",
    }
    assert any(record["record_type"] == "sync_cursor" for record in records)
    assert any(record["record_type"] == "sync_subscription" for record in records)
    source_records = [
        record
        for record in records
        if record["record_type"] in {"provider_message", "provider_calendar_event"}
    ]
    assert {record["record_type"] for record in source_records} == {
        "provider_message",
        "provider_calendar_event",
    }
    assert all(record["purpose"] == "assistant_workday" for record in source_records)
    assert all(
        record["metadata"]["content_trust"] == "untrusted_normalized"
        for record in source_records
    )
    assert all("local-refresh" not in str(record) for record in source_records)
    assert all("secret://" not in str(record) for record in source_records)


def test_worker_pauses_provider_sync_when_onebrain_becomes_unavailable() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    callback = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_worker_no_onebrain"},
    ).json()
    account_id = UUID(callback["provider_account_id"])
    worker = AssistantWorker(
        worker_id="provider-worker-onebrain-down-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        secrets=app.state.container.secrets,
        brain=DisabledBrainClient(),
    )

    result = worker.run_once()

    account = app.state.container.providers.get_account(account_id)
    jobs = app.state.container.queue.all()

    assert result.jobs_processed == 0
    assert result.blocked == 1
    assert app.state.container.providers.list_cursors() == []
    assert app.state.container.providers.list_subscriptions() == []
    assert account is not None
    assert account.status == "degraded"
    assert account.sync_state == "degraded"
    assert (
        account.last_sync_error
        == "OneBrain provenance is unavailable; provider sync is paused."
    )
    assert any(JobState(job.state) == JobState.retry_wait for job in jobs)
    assert any(JobState(job.state) == JobState.queued for job in jobs)


def test_manual_sync_and_disconnect_endpoints() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    callback = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_disconnect"},
    ).json()
    account_id = callback["provider_account_id"]

    sync = client.post(f"/v1/providers/accounts/{account_id}/sync", json={"sync_kind": "manual"})
    disconnect = client.post(f"/v1/providers/accounts/{account_id}/disconnect", json={})
    sync_after_disconnect = client.post(
        f"/v1/providers/accounts/{account_id}/sync",
        json={"sync_kind": "manual"},
    )

    assert sync.status_code == 202
    assert sync.json()["status"] == "queued"
    assert disconnect.status_code == 200
    assert disconnect.json()["status"] == "disconnected"
    assert sync_after_disconnect.status_code == 409


def test_provider_summary_keeps_write_capabilities_disabled_in_phase3() -> None:
    store = InMemoryProviderStore()
    account = store.upsert_account(
        scope=ScopedIdentity(account_id="acct", user_id="user", space_id="space"),
        provider=ProviderKind.google,
        provider_subject="google-subject",
        email="person@example.com",
        display_name="Person",
        granted_scopes=scopes_for(
            ProviderKind.google,
            OAuthScopeTier.read_only,
            [ProviderService.mail, ProviderService.calendar],
        ),
        scope_tier=OAuthScopeTier.read_only,
        refresh_token_secret_ref="secret://assistant/google/token",
    )

    summary = summarize_provider_account(account)
    write_capabilities = [
        capability for capability in summary.capabilities if capability.upgrade_tier != "read_only"
    ]

    assert summary.missing_scopes == []
    assert all(capability.granted is False for capability in write_capabilities)
    assert ProviderAccountStatus(summary.status) == ProviderAccountStatus.connected


def _provider_account(provider: ProviderKind):
    store = InMemoryProviderStore()
    return store.upsert_account(
        scope=ScopedIdentity(account_id="acct", user_id="user", space_id="space"),
        provider=provider,
        provider_subject=f"{provider}:subject",
        email=f"{provider}-account@example.com",
        display_name=f"{provider} account",
        granted_scopes=scopes_for(
            provider,
            OAuthScopeTier.read_only,
            [ProviderService.mail, ProviderService.calendar],
        ),
        scope_tier=OAuthScopeTier.read_only,
        refresh_token_secret_ref="secret://assistant/provider/token",
    )


def _store_provider_account(
    app,
    provider: ProviderKind,
    access_token: str,
    *,
    refresh_token: str = "stored-refresh-token",
    token_expires_at=None,
):
    secret_ref = app.state.container.secrets.store_secret(
        json.dumps(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "scope": " ".join(scopes_for(provider, OAuthScopeTier.read_only)),
            }
        ),
        f"{provider}-oauth-token",
    )
    return app.state.container.providers.upsert_account(
        scope=ScopedIdentity(
            account_id=app.state.container.settings.onebrain_account_id,
            user_id="user_demo",
            space_id=app.state.container.settings.onebrain_space_id,
        ),
        provider=provider,
        provider_subject=f"{provider}:live-subject",
        email=f"{provider}-account@example.com",
        display_name=f"{provider} account",
        granted_scopes=scopes_for(
            provider,
            OAuthScopeTier.read_only,
            [ProviderService.mail, ProviderService.calendar],
        ),
        scope_tier=OAuthScopeTier.read_only,
        refresh_token_secret_ref=secret_ref,
        token_expires_at=token_expires_at,
    )


def _google_refresh_handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/token"
    assert b"refresh_token=google-refresh-token" in request.content
    return httpx.Response(
        200,
        json={
            "access_token": "rotated-google-token",
            "refresh_token": "rotated-google-refresh-token",
            "expires_in": 3600,
            "scope": " ".join(scopes_for(ProviderKind.google, OAuthScopeTier.read_only)),
        },
    )


def _microsoft_refresh_handler_without_refresh_token(
    request: httpx.Request,
) -> httpx.Response:
    assert request.url.path == "/organizations/oauth2/v2.0/token"
    assert b"refresh_token=microsoft-refresh-token" in request.content
    return httpx.Response(
        200,
        json={
            "access_token": "rotated-microsoft-token",
            "expires_in": 3600,
            "scope": " ".join(scopes_for(ProviderKind.microsoft, OAuthScopeTier.read_only)),
        },
    )


def _google_invalid_grant_handler(request: httpx.Request) -> httpx.Response:
    assert request.url.path == "/token"
    assert b"refresh_token=revoked-google-refresh-token" in request.content
    return httpx.Response(
        400,
        json={"error": "invalid_grant", "error_description": "Token revoked."},
    )


def _google_history_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-google-token"
    if request.url.path == "/gmail/v1/users/me/history":
        assert request.url.params["startHistoryId"] == "123"
        return httpx.Response(
            200,
            json={
                "historyId": "456",
                "history": [{"messagesAdded": [{"message": {"id": "msg-history-1"}}]}],
            },
        )
    if request.url.path == "/gmail/v1/users/me/messages/msg-history-1":
        return httpx.Response(
            200,
            json=_google_message_payload(
                "msg-history-1",
                "History client reply",
                "History client needs a response.",
                history_id="455",
            ),
        )
    if request.url.path == "/calendar/v3/calendars/primary/events":
        return httpx.Response(200, json={"items": []})
    return httpx.Response(404, json={"error": "unexpected path"})


def _google_history_expired_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-google-token"
    if request.url.path == "/gmail/v1/users/me/history":
        return httpx.Response(404, json={"error": "history expired"})
    if request.url.path == "/gmail/v1/users/me/messages":
        return httpx.Response(200, json={"messages": [{"id": "msg-fallback-1"}]})
    if request.url.path == "/gmail/v1/users/me/messages/msg-fallback-1":
        return httpx.Response(
            200,
            json=_google_message_payload(
                "msg-fallback-1",
                "Fallback client reply",
                "Fallback full read found a message.",
                history_id="789",
            ),
        )
    if request.url.path == "/calendar/v3/calendars/primary/events":
        return httpx.Response(200, json={"items": []})
    return httpx.Response(404, json={"error": "unexpected path"})


def _microsoft_delta_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-microsoft-token"
    if request.url.path == "/v1.0/me/mailFolders/inbox/messages/delta":
        return httpx.Response(
            200,
            json={
                "value": [
                    {
                        "id": "delta-msg-1",
                        "subject": "Delta client reply",
                        "from": {"emailAddress": {"address": "client@example.com"}},
                        "toRecipients": [
                            {"emailAddress": {"address": "assistant@example.com"}}
                        ],
                        "receivedDateTime": "2026-07-09T08:35:00Z",
                        "isRead": False,
                        "importance": "normal",
                        "bodyPreview": "Delta mail body.",
                        "hasAttachments": False,
                        "categories": [],
                    }
                ],
                "@odata.deltaLink": (
                    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/"
                    "delta?$deltatoken=mail-delta"
                ),
            },
        )
    if request.url.path == "/v1.0/me/calendarView/delta":
        return httpx.Response(
            200,
            json={
                "value": [
                    {
                        "id": "delta-event-1",
                        "subject": "Delta board sync",
                        "bodyPreview": "Delta calendar body.",
                        "start": {"dateTime": "2026-07-09T14:00:00", "timeZone": "UTC"},
                        "end": {"dateTime": "2026-07-09T15:00:00", "timeZone": "UTC"},
                        "organizer": {"emailAddress": {"address": "organizer@example.com"}},
                        "attendees": [{"emailAddress": {"address": "person@example.com"}}],
                        "location": {"displayName": "Teams"},
                        "isOnlineMeeting": True,
                        "showAs": "busy",
                    }
                ],
                "@odata.nextLink": (
                    "https://graph.microsoft.com/v1.0/me/calendarView/"
                    "delta?$deltatoken=calendar-next"
                ),
            },
        )
    return httpx.Response(404, json={"error": "unexpected path"})


def _microsoft_retry_after_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-throttled-token"
    return httpx.Response(
        429,
        headers={"Retry-After": "120"},
        json={"error": {"code": "TooManyRequests", "message": "retry later"}},
    )


def _rotated_google_sync_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/token":
        return _google_refresh_handler(request)
    assert request.headers["authorization"] == "Bearer rotated-google-token"
    if request.url.path == "/gmail/v1/users/me/messages":
        return httpx.Response(200, json={"messages": [{"id": "msg-rotated-1"}]})
    if request.url.path == "/gmail/v1/users/me/messages/msg-rotated-1":
        return httpx.Response(
            200,
            json=_google_message_payload(
                "msg-rotated-1",
                "Rotated client reply",
                "Rotated token read found a message.",
                history_id="901",
            ),
        )
    if request.url.path == "/calendar/v3/calendars/primary/events":
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "evt-rotated-1",
                        "summary": "Rotated board sync",
                        "description": "Prep the rotated live board update.",
                        "start": {"dateTime": "2026-07-09T14:00:00Z"},
                        "end": {"dateTime": "2026-07-09T15:00:00Z"},
                        "organizer": {"email": "organizer@example.com"},
                        "attendees": [{"email": "person@example.com"}],
                        "hangoutLink": "https://meet.google.com/rotated",
                    }
                ]
            },
        )
    return httpx.Response(404, json={"error": "unexpected path"})


def _google_message_payload(
    message_id: str,
    subject: str,
    snippet: str,
    *,
    history_id: str,
) -> dict[str, object]:
    return {
        "id": message_id,
        "threadId": f"thread-{message_id}",
        "historyId": history_id,
        "labelIds": ["UNREAD", "IMPORTANT"],
        "internalDate": "1783528500000",
        "snippet": snippet,
        "payload": {
            "headers": [
                {"name": "Subject", "value": subject},
                {"name": "From", "value": "Client <client@example.com>"},
                {"name": "To", "value": "assistant@example.com"},
                {"name": "Date", "value": "Thu, 09 Jul 2026 08:35:00 +0000"},
            ]
        },
    }


def _google_read_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-google-token"
    if request.url.path == "/gmail/v1/users/me/messages":
        return httpx.Response(200, json={"messages": [{"id": "msg-live-1"}]})
    if request.url.path == "/gmail/v1/users/me/messages/msg-live-1":
        return httpx.Response(
            200,
            json={
                "id": "msg-live-1",
                "threadId": "thread-live-1",
                "labelIds": ["UNREAD", "IMPORTANT"],
                "internalDate": "1783528500000",
                "snippet": "Client approved the proposal and asked for next steps.",
                "payload": {
                    "headers": [
                        {"name": "Subject", "value": "Live client reply"},
                        {"name": "From", "value": "Client <client@example.com>"},
                        {"name": "To", "value": "assistant@example.com"},
                        {"name": "Date", "value": "Thu, 09 Jul 2026 08:35:00 +0000"},
                    ]
                },
            },
        )
    if request.url.path == "/calendar/v3/calendars/primary/events":
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "evt-live-1",
                        "summary": "Live board sync",
                        "description": "Prep the live board update.",
                        "start": {"dateTime": "2026-07-09T14:00:00Z"},
                        "end": {"dateTime": "2026-07-09T15:00:00Z"},
                        "organizer": {"email": "organizer@example.com"},
                        "attendees": [
                            {"email": "person-a@example.com"},
                            {"email": "person-b@example.com"},
                        ],
                        "hangoutLink": "https://meet.google.com/live",
                    }
                ]
            },
        )
    return httpx.Response(404, json={"error": "unexpected path"})


def _microsoft_read_handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["authorization"] == "Bearer live-microsoft-token"
    if request.url.path == "/v1.0/me/messages":
        return httpx.Response(
            200,
            json={
                "value": [
                    {
                        "id": "graph-msg-1",
                        "subject": "Graph client reply",
                        "from": {"emailAddress": {"address": "client@example.com"}},
                        "toRecipients": [
                            {"emailAddress": {"address": "assistant@example.com"}}
                        ],
                        "receivedDateTime": "2026-07-09T08:35:00Z",
                        "isRead": False,
                        "importance": "normal",
                        "bodyPreview": "Graph client is waiting for a reply.",
                        "hasAttachments": False,
                        "categories": [],
                    }
                ]
            },
        )
    if request.url.path == "/v1.0/me/calendarView":
        return httpx.Response(
            200,
            json={
                "value": [
                    {
                        "id": "graph-event-1",
                        "subject": "Graph board sync",
                        "bodyPreview": "Discuss the live plan.",
                        "start": {"dateTime": "2026-07-09T14:00:00", "timeZone": "UTC"},
                        "end": {"dateTime": "2026-07-09T15:00:00", "timeZone": "UTC"},
                        "organizer": {"emailAddress": {"address": "organizer@example.com"}},
                        "attendees": [{"emailAddress": {"address": "person@example.com"}}],
                        "location": {"displayName": "Teams"},
                        "isOnlineMeeting": True,
                        "showAs": "busy",
                    }
                ]
            },
        )
    return httpx.Response(404, json={"error": "unexpected path"})


def _unauthorized_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(401, json={"error": "unauthorized"})
