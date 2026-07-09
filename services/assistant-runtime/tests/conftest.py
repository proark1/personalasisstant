from __future__ import annotations

from fastapi.testclient import TestClient

from assistant_runtime.domain.sessions import mint_session
from assistant_runtime.schemas import ScopedIdentity


def authed_client(
    app,
    *,
    account_id: str | None = None,
    user_id: str = "user_test",
    space_id: str | None = None,
) -> TestClient:
    """A ``TestClient`` with a valid assistant session bearer attached to every request.

    Mints a session directly against the app's session store so it works regardless of
    the configured identity mode. The login endpoint itself is covered in test_auth.py.
    """
    container = app.state.container
    settings = container.settings
    scope = ScopedIdentity(
        account_id=account_id or settings.onebrain_account_id,
        user_id=user_id,
        space_id=space_id or settings.onebrain_space_id,
    )
    token, _ = mint_session(
        container.sessions, scope=scope, identity_source="test", ttl_seconds=3600
    )
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
