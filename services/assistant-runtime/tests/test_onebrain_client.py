from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from assistant_runtime.config import Settings
from assistant_runtime.providers.onebrain import (
    HttpOneBrainClient,
    OneBrainClientError,
    build_brain_client,
)


def test_settings_use_canonical_onebrain_base_url_env(monkeypatch) -> None:
    # Migration guard: the legacy env name must not override the canonical one.
    monkeypatch.setenv("ONEBRAIN_API_URL", "https://legacy-onebrain.test")
    monkeypatch.setenv("ONEBRAIN_API_BASE_URL", "https://canonical-onebrain.test")

    settings = Settings(_env_file=None)

    assert settings.onebrain_api_base_url == "https://canonical-onebrain.test"


def test_legacy_onebrain_api_url_env_is_ignored(monkeypatch) -> None:
    # Migration guard: keep this old name only to prove fallback support is gone.
    monkeypatch.delenv("ONEBRAIN_API_BASE_URL", raising=False)
    monkeypatch.setenv("ONEBRAIN_API_URL", "https://legacy-onebrain.test")

    settings = Settings(_env_file=None)

    assert settings.onebrain_api_base_url == "http://localhost:8080"


def test_build_brain_client_uses_canonical_base_url_and_scope() -> None:
    client = build_brain_client(
        Settings(
            _env_file=None,
            ONEBRAIN_API_BASE_URL="https://canonical-onebrain.test",
            ONEBRAIN_SERVICE_KEY="svc_test",
            ONEBRAIN_ACCOUNT_ID="acme",
            ONEBRAIN_SPACE_ID="sp_business",
        )
    )

    assert isinstance(client, HttpOneBrainClient)
    assert client.base_url == "https://canonical-onebrain.test/"
    assert client.account_id == "acme"
    assert client.space_id == "sp_business"


def test_http_onebrain_client_uses_assistant_contract_routes() -> None:
    seen: list[tuple[str, str, dict, dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8")) if request.content else {}
        params = dict(request.url.params)
        seen.append((request.method, str(request.url), payload, params))
        assert request.headers["authorization"] == "Bearer svc_test"

        if request.url.path == "/api/service/capabilities":
            assert params == {
                "account_id": "acme",
                "space_id": "sp_business",
                "app_id": "assistant",
                "purpose": "assistant_provider_health",
            }
            return httpx.Response(200, json={"tenant_id": "acme", "scopes": ["read", "write"]})
        if request.url.path == "/api/service/assistant/records" and request.method == "POST":
            assert payload["account_id"] == "acme"
            assert payload["space_id"] == "sp_business"
            assert payload["app_id"] == "assistant"
            assert payload["purpose"] == "assistant_briefing"
            return httpx.Response(
                200,
                json={
                    "record": {
                        "id": "rec_1",
                        "content": payload["content"],
                        "record_type": payload["record_type"],
                        "purpose": payload["purpose"],
                    }
                },
            )
        if request.url.path == "/api/service/assistant/records" and request.method == "GET":
            assert params == {
                "account_id": "acme",
                "space_id": "sp_business",
                "app_id": "assistant",
                "purpose": "assistant_briefing",
                "record_type": "brief",
                "limit": "50",
            }
            return httpx.Response(200, json={"records": [{"id": "rec_1"}]})
        if request.url.path == "/api/service/assistant/records/rec_1":
            assert params == {
                "account_id": "acme",
                "space_id": "sp_business",
                "app_id": "assistant",
                "purpose": "assistant_briefing",
            }
            return httpx.Response(200, json={"record": {"id": "rec_1"}})
        if request.url.path == "/api/service/assistant/audit":
            assert payload["account_id"] == "acme"
            assert payload["space_id"] == "sp_business"
            assert payload["app_id"] == "assistant"
            assert payload["purpose"] == "assistant_action"
            return httpx.Response(200, json={"id": "aud_1", "action": payload["action"]})
        return httpx.Response(404, json={"detail": "not found"})

    client = HttpOneBrainClient(
        base_url="https://onebrain.test",
        service_key="svc_test",
        account_id="acme",
        space_id="sp_business",
        transport=httpx.MockTransport(handler),
    )

    assert asyncio.run(client.check_available()) is True
    created = asyncio.run(
        client.create_assistant_record(
            content="Brief",
            record_type="brief",
            purpose="assistant_briefing",
            account_id="acme",
            space_id="sp_business",
        )
    )
    listed = asyncio.run(
        client.list_assistant_records(
            account_id="acme",
            space_id="sp_business",
            purpose="assistant_briefing",
            record_type="brief",
        )
    )
    fetched = asyncio.run(
        client.get_assistant_record(
            "rec_1",
            account_id="acme",
            space_id="sp_business",
            purpose="assistant_briefing",
        )
    )
    audit = asyncio.run(
        client.record_audit_event(
            action="assistant.action.proposed",
            target_type="action",
            target_id="act_1",
            account_id="acme",
            space_id="sp_business",
        )
    )

    assert created["id"] == "rec_1"
    assert listed == [{"id": "rec_1"}]
    assert fetched == {"id": "rec_1"}
    assert audit["id"] == "aud_1"
    assert [method for method, _, _, _ in seen] == ["GET", "POST", "GET", "GET", "POST"]


def test_http_onebrain_client_rejects_wrong_capability_scope() -> None:
    client = HttpOneBrainClient(
        base_url="https://onebrain.test",
        service_key="svc_test",
        account_id="acme",
        space_id="sp_business",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "account_id": "acme",
                    "app_id": "communication",
                    "space_ids": ["sp_business"],
                },
            )
        ),
    )

    assert asyncio.run(client.check_available()) is False


def test_http_onebrain_client_rejects_missing_service_purpose() -> None:
    client = HttpOneBrainClient(
        base_url="https://onebrain.test",
        service_key="svc_test",
        account_id="acme",
        space_id="sp_business",
        transport=httpx.MockTransport(lambda request: httpx.Response(500)),
    )

    with pytest.raises(OneBrainClientError, match="purpose"):
        asyncio.run(
            client.list_assistant_records(
                account_id="acme",
                space_id="sp_business",
                purpose="",
            )
        )
