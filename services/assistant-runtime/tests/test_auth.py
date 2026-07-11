from __future__ import annotations

from datetime import timedelta

from conftest import authed_client
from fastapi.testclient import TestClient

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.domain.sessions import hash_session_token, new_session_token
from assistant_runtime.schemas import ScopedIdentity, SessionRecord, utc_now


def _app():
    return create_app(Settings(ONEBRAIN_CLIENT_MODE="memory", ONEBRAIN_AVAILABLE=True))


def test_unauthenticated_business_requests_are_rejected() -> None:
    client = TestClient(_app())

    assert client.get("/v1/today").status_code == 401
    assert client.get("/v1/providers").status_code == 401
    assert client.get("/v1/workday/brief").status_code == 401
    assert client.post("/v1/actions", json={"idempotency_key": "x"}).status_code == 401


def test_public_routes_do_not_require_auth() -> None:
    client = TestClient(_app())

    assert client.get("/health/live").status_code == 200
    assert client.get("/health/ready").status_code == 200
    assert client.get("/metrics").status_code == 200


def test_login_stub_mode_mints_session_and_authenticates() -> None:
    client = TestClient(_app())

    login = client.post("/v1/auth/login", json={})
    assert login.status_code == 200
    body = login.json()
    assert body["token_type"] == "bearer"
    assert body["identity_source"] == "stub"

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/v1/today", headers=headers).status_code == 200
    me = client.get("/v1/auth/session", headers=headers)
    assert me.status_code == 200
    assert me.json()["scope"]["account_id"] == body["scope"]["account_id"]


def _onebrain_identity_app(handler) -> TestClient:
    import httpx

    from assistant_runtime.auth.identity import OneBrainIdentityProvider

    settings = Settings(
        ONEBRAIN_CLIENT_MODE="memory",
        ONEBRAIN_AVAILABLE=True,
        AUTH_IDENTITY_MODE="onebrain",
        ONEBRAIN_SERVICE_KEY="sk_test_key",
        ONEBRAIN_API_BASE_URL="http://onebrain.test",
    )
    app = create_app(settings)
    app.state.container.identity = OneBrainIdentityProvider(
        settings, transport=httpx.MockTransport(handler)
    )
    return TestClient(app)


def test_onebrain_identity_login_resolves_user_and_mints_session() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/service/assistant/identity/login"
        assert request.headers["authorization"] == "Bearer sk_test_key"
        return httpx.Response(
            200,
            json={
                "user_id": "user_real",
                "email": "owner@acme.test",
                "display_name": "Owner",
                "tenant_id": "acct_real",
                "account_id": "acct_real",
                "space_id": "sp_real",
            },
        )

    client = _onebrain_identity_app(handler)
    login = client.post(
        "/v1/auth/login", json={"email": "owner@acme.test", "password": "pw"}
    )

    assert login.status_code == 200
    body = login.json()
    assert body["identity_source"] == "onebrain"
    assert body["scope"]["account_id"] == "acct_real"
    assert body["scope"]["user_id"] == "user_real"
    assert body["scope"]["space_id"] == "sp_real"
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/v1/auth/session", headers=headers).status_code == 200


def test_onebrain_identity_login_rejects_bad_credentials() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Invalid email or password."})

    client = _onebrain_identity_app(handler)

    response = client.post(
        "/v1/auth/login", json={"email": "owner@acme.test", "password": "wrong"}
    )
    assert response.status_code == 401


def test_onebrain_identity_login_without_credentials_is_rejected() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("must not call OneBrain without credentials")

    client = _onebrain_identity_app(handler)

    assert client.post("/v1/auth/login", json={}).status_code == 401


def test_onebrain_identity_fails_closed_when_endpoint_is_missing() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "Not Found"})

    client = _onebrain_identity_app(handler)

    response = client.post(
        "/v1/auth/login", json={"email": "owner@acme.test", "password": "pw"}
    )
    assert response.status_code == 503
    # Enforcement still works regardless of identity-provider state.
    assert client.get("/v1/today").status_code == 401


def test_onebrain_identity_surfaces_wrong_app_service_key_as_misconfiguration() -> None:
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403, json={"detail": "This service key is pinned to a different app."}
        )

    client = _onebrain_identity_app(handler)

    response = client.post(
        "/v1/auth/login", json={"email": "owner@acme.test", "password": "pw"}
    )
    # A key pinned to another app is an authority/config failure (503), never a
    # credentials failure (401) — the user cannot fix it by retyping a password.
    assert response.status_code == 503


def test_invalid_and_malformed_tokens_are_rejected() -> None:
    client = TestClient(_app())

    assert client.get("/v1/today", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/v1/today", headers={"Authorization": "Basic abc"}).status_code == 401
    assert client.get("/v1/today", headers={"Authorization": "garbage"}).status_code == 401


def test_logout_revokes_session() -> None:
    app = _app()
    client = TestClient(app)
    token = client.post("/v1/auth/login", json={}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/v1/today", headers=headers).status_code == 200
    assert client.post("/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/v1/today", headers=headers).status_code == 401


def test_expired_session_is_rejected() -> None:
    app = _app()
    container = app.state.container
    token = new_session_token()
    container.sessions.create_session(
        SessionRecord(
            scope=ScopedIdentity(
                account_id=container.settings.onebrain_account_id,
                user_id="user_test",
                space_id=container.settings.onebrain_space_id,
            ),
            token_hash=hash_session_token(token),
            identity_source="test",
            expires_at=utc_now() - timedelta(seconds=1),
        )
    )
    client = TestClient(app)

    assert client.get("/v1/today", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_telegram_binding_is_hidden_from_other_accounts() -> None:
    app = _app()
    owner = authed_client(app, account_id="acct_owner", space_id="space_owner")
    setup = owner.post(
        "/v1/telegram/setup", json={"bot_token": "123456:secret-token-value"}
    ).json()

    other = authed_client(app, account_id="acct_other", space_id="space_other")

    assert owner.get(f"/v1/telegram/bindings/{setup['binding_id']}").status_code == 200
    assert other.get(f"/v1/telegram/bindings/{setup['binding_id']}").status_code == 404
    assert (
        other.post(
            f"/v1/telegram/bindings/{setup['binding_id']}/test-message", json={}
        ).status_code
        == 404
    )


def test_scope_mismatch_is_not_found() -> None:
    app = _app()
    owner = authed_client(app, account_id="acct_owner", space_id="space_owner")
    action = owner.post("/v1/actions", json={"idempotency_key": "scope-guard"}).json()

    other = authed_client(app, account_id="acct_other", space_id="space_other")
    approve = other.post(f"/v1/actions/{action['action_id']}/approve", json={})

    assert approve.status_code == 404
