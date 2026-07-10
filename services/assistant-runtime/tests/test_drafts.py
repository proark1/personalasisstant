from __future__ import annotations

from conftest import authed_client

from assistant_runtime.api.app import create_app
from assistant_runtime.config import Settings
from assistant_runtime.providers.oauth import scopes_for
from assistant_runtime.schemas import (
    OAuthScopeTier,
    ProviderKind,
    ProviderService,
    ScopedIdentity,
)

ACCOUNT = "acct_demo"
SPACE = "space_demo"


def _app():
    return create_app(
        Settings(_env_file=None, ONEBRAIN_CLIENT_MODE="memory", ONEBRAIN_AVAILABLE=True)
    )


def _authed(app):
    return authed_client(app, account_id=ACCOUNT, space_id=SPACE)


def _grant_draft_write(app) -> None:
    app.state.container.providers.upsert_account(
        scope=ScopedIdentity(account_id=ACCOUNT, user_id="user_test", space_id=SPACE),
        provider=ProviderKind.google,
        provider_subject="google-subject",
        email="owner@example.com",
        display_name="Owner",
        granted_scopes=scopes_for(
            ProviderKind.google, OAuthScopeTier.draft_write, [ProviderService.mail]
        ),
        scope_tier=OAuthScopeTier.draft_write,
        refresh_token_secret_ref="secret://assistant/google/token",
    )


def _propose(client) -> dict:
    response = client.post(
        "/v1/drafts",
        json={
            "source_ref": "onebrain://message/inbox-1",
            "recipient_ref": "onebrain://contact/client",
            "subject": "Proposal follow-up",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_propose_draft_creates_action_with_snapshot_hash() -> None:
    client = _authed(_app())
    draft = _propose(client)
    assert draft["action_type"] == "create_email_draft"
    assert draft["state"] == "proposed"
    assert draft["draft_subject"].startswith("Re:")
    assert draft["draft_body"]
    assert len(draft["content_hash"]) == 64  # sha256 hex


def test_editing_a_draft_changes_the_content_hash() -> None:
    client = _authed(_app())
    draft = _propose(client)

    edited = client.post(
        f"/v1/actions/{draft['action_id']}/draft",
        json={"subject": "Re: Proposal follow-up", "body": "Confirmed — Tuesday at 3pm works."},
    ).json()

    assert edited["draft_body"] == "Confirmed — Tuesday at 3pm works."
    assert edited["content_hash"] != draft["content_hash"]


def test_approve_rejects_a_stale_content_hash() -> None:
    app = _app()
    _grant_draft_write(app)
    client = _authed(app)
    draft = _propose(client)

    approve = client.post(
        f"/v1/actions/{draft['action_id']}/approve",
        json={"content_hash": "stale-hash-does-not-match"},
    )
    assert approve.status_code == 409
    assert "changed" in approve.json()["detail"].lower()


def test_approve_draft_requires_draft_write_scope() -> None:
    client = _authed(_app())  # no connected write-capable account
    draft = _propose(client)

    approve = client.post(
        f"/v1/actions/{draft['action_id']}/approve",
        json={"content_hash": draft["content_hash"]},
    )
    assert approve.status_code == 409
    assert "draft-write" in approve.json()["detail"]


def test_approve_with_matching_hash_and_write_scope_succeeds() -> None:
    app = _app()
    _grant_draft_write(app)
    client = _authed(app)
    draft = _propose(client)

    approve = client.post(
        f"/v1/actions/{draft['action_id']}/approve",
        json={"content_hash": draft["content_hash"]},
    )
    assert approve.status_code == 200
    assert approve.json()["state"] == "approved"


def test_editing_after_approval_resets_to_needs_review() -> None:
    app = _app()
    _grant_draft_write(app)
    client = _authed(app)
    draft = _propose(client)
    approved = client.post(
        f"/v1/actions/{draft['action_id']}/approve",
        json={"content_hash": draft["content_hash"]},
    ).json()
    assert approved["state"] == "approved"

    edited = client.post(
        f"/v1/actions/{draft['action_id']}/draft",
        json={"subject": approved["draft_subject"], "body": "Changed my mind — Wednesday instead."},
    ).json()

    assert edited["state"] == "needs_review"
    assert edited["content_hash"] != draft["content_hash"]


def test_draft_scope_is_isolated_across_accounts() -> None:
    app = _app()
    owner = _authed(app)
    draft = _propose(owner)

    other = authed_client(app, account_id="acct_other", space_id="space_other")
    assert other.post(
        f"/v1/actions/{draft['action_id']}/draft",
        json={"subject": "x", "body": "y"},
    ).status_code == 404
