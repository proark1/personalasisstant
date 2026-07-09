from __future__ import annotations

from assistant_runtime.config import Settings
from assistant_runtime.schemas import LoginRequest, ResolvedIdentity


class IdentityAuthorityUnavailable(RuntimeError):
    """Raised when session minting is delegated to OneBrain but not yet available."""


class OneBrainIdentityProvider:
    """Deferred: delegates login to the OneBrain identity authority.

    OneBrain does not yet expose an identity/session endpoint reachable from this
    service, so login fails closed until that endpoint exists. When it ships,
    implement ``resolve_login`` to call it — no other part of the auth layer changes.
    """

    mode = "onebrain"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def resolve_login(self, request: LoginRequest) -> ResolvedIdentity | None:
        raise IdentityAuthorityUnavailable(
            "OneBrain identity authority is unavailable; session minting is deferred."
        )


class StubIdentityProvider:
    """Dev/test only: mints an identity bound to the configured account/space.

    Never selected in production/staging (see ``Settings.resolved_auth_identity_mode``).
    Optional per-request overrides make it easy to exercise multi-account scoping in tests.
    """

    mode = "stub"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def resolve_login(self, request: LoginRequest) -> ResolvedIdentity | None:
        return ResolvedIdentity(
            account_id=request.account_id or self._settings.onebrain_account_id,
            user_id=request.user_id or "user_local",
            space_id=request.space_id or self._settings.onebrain_space_id,
            identity_source="stub",
        )


def build_identity_provider(settings: Settings) -> OneBrainIdentityProvider | StubIdentityProvider:
    """Select the identity provider. ``stub`` for local/test, OneBrain (deferred) otherwise."""
    if settings.resolved_auth_identity_mode == "stub":
        return StubIdentityProvider(settings)
    return OneBrainIdentityProvider(settings)
