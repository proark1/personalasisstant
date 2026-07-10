from __future__ import annotations

from conftest import authed_client
from fastapi.testclient import TestClient

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings


def _app():
    return create_app(
        Settings(_env_file=None, ONEBRAIN_CLIENT_MODE="memory", ONEBRAIN_AVAILABLE=True)
    )


def _ask(client, question: str) -> dict:
    response = client.post("/v1/assistant/ask", json={"question": question})
    assert response.status_code == 200
    return response.json()


def test_day_overview_question_answers_from_brief() -> None:
    client = authed_client(_app())
    body = _ask(client, "What does my day look like?")
    assert body["intent"] == "workday"
    assert "Morning brief" in body["answer"]
    assert body["spoken"] == body["answer"]


def test_waiting_question_answers_with_followups() -> None:
    client = authed_client(_app())
    body = _ask(client, "What am I waiting on?")
    assert body["intent"] == "follow_up"
    assert "Follow-ups" in body["answer"]


def test_availability_question_answers_with_focus_windows() -> None:
    client = authed_client(_app())
    body = _ask(client, "Do I have time for a client call this afternoon?")
    assert body["intent"] == "calendar_focus"
    assert "focus time" in body["answer"].lower()


def test_priority_question_lists_priorities() -> None:
    client = authed_client(_app())
    body = _ask(client, "What should I focus on first?")
    assert body["intent"] == "priority"
    assert "priorities" in body["answer"].lower()


def test_unrecognized_question_falls_back_to_overview_with_nudge() -> None:
    client = authed_client(_app())
    body = _ask(client, "sing me a song")
    assert body["intent"] == "workday"
    assert "You can ask" in body["answer"]


def test_ask_records_voice_transcript_provenance() -> None:
    app = _app()
    client = authed_client(app)
    _ask(client, "What am I waiting on?")
    record_types = {r["record_type"] for r in app.state.container.brain.records.values()}
    assert "voice_transcript" in record_types


def test_ask_requires_authentication() -> None:
    client = TestClient(_app())
    assert client.post("/v1/assistant/ask", json={"question": "hi"}).status_code == 401
