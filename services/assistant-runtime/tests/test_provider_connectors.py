from __future__ import annotations

import asyncio
import json
from uuid import UUID

import httpx
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
from assistant_runtime.schemas import (
    JobState,
    OAuthScopeTier,
    ProviderAccountStatus,
    ProviderKind,
    ProviderService,
    ScopedIdentity,
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
    return TestClient(create_app(_settings(**overrides)))


def test_provider_status_reports_missing_configuration_without_breaking_local_dev() -> None:
    client = TestClient(
        create_app(
            Settings(
                ONEBRAIN_CLIENT_MODE="memory",
                GOOGLE_OAUTH_CLIENT_ID="",
                GOOGLE_OAUTH_CLIENT_SECRET="",
                MICROSOFT_OAUTH_CLIENT_ID="",
                MICROSOFT_OAUTH_CLIENT_SECRET="",
            )
        )
    )

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
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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


def _store_provider_account(app, provider: ProviderKind, access_token: str):
    secret_ref = app.state.container.secrets.store_secret(
        json.dumps(
            {
                "access_token": access_token,
                "refresh_token": "stored-refresh-token",
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
    )


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
