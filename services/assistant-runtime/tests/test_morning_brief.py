from __future__ import annotations

from datetime import UTC, datetime

from conftest import authed_client

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.domain.brief import compose_brief_message
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.providers.morning_brief import BRIEF_JOB_TYPE
from assistant_runtime.schemas import (
    JobRecord,
    PriorityItem,
    ScopedIdentity,
    WorkdayBrief,
    WorkdayPartialState,
    WorkdaySnapshot,
)
from assistant_runtime.worker.runner import AssistantWorker


def _settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        ONEBRAIN_CLIENT_MODE="memory",
        ONEBRAIN_AVAILABLE=True,
        TELEGRAM_WEBHOOK_SECRET="brief-webhook-secret",
        **overrides,
    )


def _snapshot(**overrides) -> WorkdaySnapshot:
    base = {
        "account_id": "acct",
        "user_id": "user",
        "space_id": "space",
        "local_date": "2026-07-10",
        "brief": WorkdayBrief(
            brief_id="b1", title="Morning brief", summary="s", local_date="2026-07-10"
        ),
        "priorities": [
            PriorityItem(
                priority_id="p1", title="Client proposal reply", detail="d", reason="r", score=90
            ),
            PriorityItem(
                priority_id="p2", title="Prep board sync", detail="d", reason="r", score=80
            ),
        ],
        "proactive_suggestion": "Start with the client proposal reply.",
        "partial_state": WorkdayPartialState(),
    }
    base.update(overrides)
    return WorkdaySnapshot(**base)


def test_compose_brief_message_is_concise_and_safe() -> None:
    message = compose_brief_message(_snapshot())

    assert "Morning brief — 2026-07-10" in message
    assert "Start with the client proposal reply." in message
    assert "1. Client proposal reply" in message
    assert "Waiting on you: 0 · Inbox to triage: 0 · Approvals: 0" in message


def test_compose_brief_message_flags_degraded_sources() -> None:
    degraded = WorkdayPartialState(degraded=True, reasons=["OneBrain unavailable"])
    message = compose_brief_message(_snapshot(partial_state=degraded))
    assert "degraded" in message


def test_schedule_endpoint_enqueues_recurring_brief_job() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    response = client.post(
        "/v1/workday/brief/schedule",
        json={"local_time": "7:5", "timezone": "Europe/Berlin"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "scheduled"
    assert body["local_time"] == "07:05"
    jobs = app.state.container.queue.all()
    assert [job.job_type for job in jobs] == [BRIEF_JOB_TYPE]
    assert jobs[0].payload_ref == "workday-brief://07:05"


def test_schedule_endpoint_rejects_bad_time_and_timezone() -> None:
    app = create_app(_settings())
    client = authed_client(app)

    bad_time = client.post("/v1/workday/brief/schedule", json={"local_time": "25:00"})
    bad_zone = client.post("/v1/workday/brief/schedule", json={"timezone": "Mars/Olympus"})
    assert bad_time.status_code == 422
    assert bad_zone.status_code == 422


def _worker(app) -> AssistantWorker:
    return AssistantWorker(
        worker_id="brief-worker-test",
        actions=app.state.container.actions,
        outbox=app.state.container.outbox,
        queue=app.state.container.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=app.state.container.telegram,
        providers=app.state.container.providers,
        brain=app.state.container.brain,
    )


def _bind_telegram(client, app):
    """Verify a Telegram binding for the authed scope; return that scope."""
    setup = client.post(
        "/v1/telegram/setup", json={"bot_token": "123456:brief-secret-token"}
    ).json()
    payload = {
        "update_id": 900,
        "message": {
            "message_id": 910,
            "chat": {"id": 555, "type": "private"},
            "from": {"id": 666, "is_bot": False},
            "text": setup["binding_command"],
        },
    }
    resp = client.post(
        "/v1/telegram/webhook",
        json=payload,
        headers={"X-Telegram-Bot-Api-Secret-Token": "brief-webhook-secret"},
    )
    assert resp.json()["status"] == "bound"
    return app.state.container.telegram.bindings.list_bindings()[0].scope


def _brief_job(scope, run_at: datetime) -> JobRecord:
    return JobRecord(
        scope=scope,
        job_type=BRIEF_JOB_TYPE,
        payload_ref="workday-brief://07:30",
        idempotency_key=f"{scope.account_id}:{scope.user_id}:{BRIEF_JOB_TYPE}:{run_at.date()}",
        timezone="UTC",
        run_at=run_at,
    )


def test_worker_delivers_brief_to_verified_binding_and_reschedules() -> None:
    app = create_app(_settings())
    client = authed_client(app)
    scope = _bind_telegram(client, app)
    app.state.container.queue.enqueue(_brief_job(scope, datetime(2026, 7, 9, 7, 30, tzinfo=UTC)))
    worker = _worker(app)

    result = worker.run_once()

    brief_rows = [
        r for r in app.state.container.outbox.all() if r.effect_type == "telegram.message.send"
    ]
    job_types = [j.job_type for j in app.state.container.queue.all()]
    assert result.jobs_processed == 1
    assert len(brief_rows) == 1
    # Rescheduled one day later (original + next-day brief job).
    assert job_types.count(BRIEF_JOB_TYPE) == 2
    rescheduled = [j for j in app.state.container.queue.all() if j.run_at.date().day == 10]
    assert len(rescheduled) == 1


def test_worker_skips_delivery_when_no_verified_binding() -> None:
    app = create_app(_settings())
    scope = ScopedIdentity(account_id="acct_demo", user_id="user_test", space_id="space_demo")
    app.state.container.queue.enqueue(_brief_job(scope, datetime(2026, 7, 9, 7, 30, tzinfo=UTC)))
    worker = _worker(app)

    result = worker.run_once()

    brief_rows = [
        r for r in app.state.container.outbox.all() if r.effect_type == "telegram.message.send"
    ]
    assert result.jobs_processed == 1
    assert brief_rows == []
