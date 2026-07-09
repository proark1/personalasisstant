from __future__ import annotations

from conftest import authed_client

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.schemas import JobRecord, JobState, ScopedIdentity, utc_now
from assistant_runtime.worker.runner import AssistantWorker


def _settings(**overrides):
    values = {
        "ONEBRAIN_CLIENT_MODE": "memory",
        "ONEBRAIN_AVAILABLE": True,
        **overrides,
    }
    return Settings(**values)


def test_workday_today_generates_durable_onebrain_artifacts() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    response = client.get("/v1/workday/today", params={"local_date": "2026-07-09"})

    assert response.status_code == 200
    snapshot = response.json()
    assert snapshot["partial_state"]["durable"] is True
    assert snapshot["partial_state"]["generated_from"] == "deterministic_fallback"
    assert "live_email_calendar" in snapshot["partial_state"]["missing_sources"]
    assert len(snapshot["priorities"]) == 3
    assert len(snapshot["inbox"]) == 3
    assert len(snapshot["follow_ups"]) == 1
    assert len(snapshot["calendar"]) == 1

    record_types = {record["record_type"] for record in app.state.container.brain.records.values()}
    assert {
        "workday_brief",
        "priority_item",
        "inbox_triage",
        "follow_up_risk",
        "calendar_insight",
    }.issubset(record_types)


def test_workday_today_is_ephemeral_when_onebrain_is_unavailable() -> None:
    app = create_app(_settings(ONEBRAIN_AVAILABLE=False))
    client = authed_client(app)

    response = client.get("/v1/workday/today", params={"local_date": "2026-07-09"})

    assert response.status_code == 200
    snapshot = response.json()
    assert snapshot["partial_state"]["durable"] is False
    assert snapshot["partial_state"]["degraded"] is True
    assert "OneBrain unavailable" in snapshot["partial_state"]["reasons"][0]


def test_today_endpoint_uses_phase4a_workday_snapshot() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    response = client.get("/v1/today")

    assert response.status_code == 200
    body = response.json()
    assert body["inbox_count"] == 3
    assert body["priorities"][0]["title"] == "Client proposal reply"
    assert body["proactive_suggestion"].startswith("Start with Client proposal reply")
    assert all(item["title"] != "Important relationship" for item in body["brief"])


def test_workday_prefers_onebrain_provider_source_records() -> None:
    app = create_app(
        _settings(
            GOOGLE_OAUTH_CLIENT_ID="google-client",
            GOOGLE_OAUTH_CLIENT_SECRET="google-secret",
        )
    )
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/google/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    callback = client.get(
        "/v1/providers/oauth/google/callback",
        params={"state": state, "code": "test_google_workday_sources"},
    )
    worker = _worker(app)

    result = worker.run_once()
    response = client.get(
        "/v1/workday/today",
        params={"local_date": utc_now().date().isoformat()},
    )

    assert callback.status_code == 200
    assert result.jobs_processed == 1
    assert response.status_code == 200
    snapshot = response.json()
    assert snapshot["partial_state"]["generated_from"] == "onebrain_provider_records"
    assert "onebrain_provider_records" not in snapshot["partial_state"]["missing_sources"]
    assert snapshot["inbox"][0]["source_ref"].startswith("onebrain://provider-source/")
    assert snapshot["inbox"][0]["sender"] == "client@example.com"


def test_workday_reports_fallback_when_connected_provider_has_no_source_records() -> None:
    app = create_app(
        _settings(
            MICROSOFT_OAUTH_CLIENT_ID="microsoft-client",
            MICROSOFT_OAUTH_CLIENT_SECRET="microsoft-secret",
        )
    )
    client = authed_client(app)
    started = client.post("/v1/providers/oauth/microsoft/start", json={}).json()
    state = started["authorization_url"].split("state=", 1)[1].split("&", 1)[0]
    callback = client.get(
        "/v1/providers/oauth/microsoft/callback",
        params={"state": state, "code": "test_microsoft_unsynced_workday"},
    )

    response = client.get(
        "/v1/workday/today",
        params={"local_date": utc_now().date().isoformat()},
    )

    assert callback.status_code == 200
    assert response.status_code == 200
    snapshot = response.json()
    assert snapshot["partial_state"]["generated_from"] == "deterministic_fallback"
    assert "onebrain_provider_records" in snapshot["partial_state"]["missing_sources"]
    assert any(":missing" in source for source in snapshot["partial_state"]["stale_sources"])


def test_workday_detail_endpoints_return_typed_sections() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    brief = client.get("/v1/workday/brief", params={"local_date": "2026-07-09"})
    inbox = client.get("/v1/workday/inbox", params={"local_date": "2026-07-09"})
    followups = client.get("/v1/workday/follow-ups", params={"local_date": "2026-07-09"})
    calendar = client.get("/v1/workday/calendar", params={"local_date": "2026-07-09"})

    assert brief.status_code == 200
    assert inbox.status_code == 200
    assert followups.status_code == 200
    assert calendar.status_code == 200
    assert brief.json()["brief"]["title"] == "Morning brief"
    assert inbox.json()["items"][0]["category"] == "priority"
    assert followups.json()["risks"][0]["status"] == "due"
    assert calendar.json()["insights"][0]["focus_windows"][0]["quality"] == "high"


def test_workday_regenerate_returns_stored_snapshot_when_onebrain_available() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    response = client.post(
        "/v1/workday/regenerate",
        json={"local_date": "2026-07-09"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "generated"
    assert body["snapshot"]["partial_state"]["durable"] is True


def test_worker_processes_workday_job() -> None:
    app = create_app(_settings())
    scope = ScopedIdentity(account_id="acct_demo", user_id="user_demo", space_id="space_demo")
    job = JobRecord(
        scope=scope,
        job_type="workday.brief.regenerate",
        payload_ref="workday://2026-07-09",
        idempotency_key="workday-regenerate-test",
        timezone="UTC",
        run_at=utc_now(),
    )
    app.state.container.queue.enqueue(job)
    worker = _worker(app)

    result = worker.run_once()

    assert result.jobs_processed == 1
    assert result.blocked == 0
    assert app.state.container.queue.all()[0].state == JobState.succeeded
    assert any(
        record["record_type"] == "workday_brief"
        for record in app.state.container.brain.records.values()
    )


def test_worker_retries_workday_job_when_onebrain_is_unavailable() -> None:
    app = create_app(_settings(ONEBRAIN_AVAILABLE=False))
    scope = ScopedIdentity(account_id="acct_demo", user_id="user_demo", space_id="space_demo")
    job = JobRecord(
        scope=scope,
        job_type="workday.brief.regenerate",
        payload_ref="workday://2026-07-09",
        idempotency_key="workday-regenerate-onebrain-down-test",
        timezone="UTC",
        run_at=utc_now(),
    )
    app.state.container.queue.enqueue(job)
    worker = _worker(app)

    result = worker.run_once()

    stored = app.state.container.queue.all()[0]
    assert result.jobs_processed == 0
    assert result.blocked == 1
    assert JobState(stored.state) == JobState.retry_wait
    assert stored.last_error == "RuntimeError"


def _worker(app) -> AssistantWorker:
    return AssistantWorker(
        worker_id="workday-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        brain=app.state.container.brain,
    )
