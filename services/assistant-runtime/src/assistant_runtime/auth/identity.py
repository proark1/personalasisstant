from __future__ import annotations

import httpx

from assistant_runtime.config import Settings
from assistant_runtime.schemas import LoginRequest, ResolvedIdentity


class IdentityAuthorityUnavailable(RuntimeError):
    """Raised when session minting is delegated to OneBrain but not yet available."""


class OneBrainIdentityProvider:
    """Delegates login to the OneBrain identity authority.

    The user's OneBrain credentials are forwarded once to OneBrain's
    service-authenticated identity endpoint, which verifies them (timing-safe,
    throttled, tenant-bound) and returns the resolved user/account/space. The
    assistant never stores the credentials — it mints only its own session
    reference from the resolved identity.
    """

    mode = "onebrain"

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._transport = transport

    async def resolve_login(self, request: LoginRequest) -> ResolvedIdentity | None:
        if not self._settings.onebrain_service_key:
            raise IdentityAuthorityUnavailable(
                "OneBrain identity authority is not configured (missing service key)."
            )
        email = (request.email or "").strip()
        password = request.password or ""
        if not email or not password:
            return None

        url = self._settings.onebrain_api_base_url.rstrip("/") + (
            "/api/service/assistant/identity/login"
        )
        try:
            async with httpx.AsyncClient(
                timeout=self._settings.onebrain_timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    url,
                    json={"email": email, "password": password},
                    headers={
                        "Authorization": f"Bearer {self._settings.onebrain_service_key}",
                        "Accept": "application/json",
                    },
                )
        except httpx.HTTPError as exc:
            raise IdentityAuthorityUnavailable(
                "OneBrain identity authority is unreachable."
            ) from exc

        if response.status_code == 401:
            return None
        if response.status_code == 429:
            raise IdentityAuthorityUnavailable(
                "OneBrain identity authority is throttling login attempts; try again shortly."
            )
        if response.status_code in {404, 405}:
            # Older OneBrain deployment without the identity endpoint: fail closed.
            raise IdentityAuthorityUnavailable(
                "OneBrain identity endpoint is unavailable; session minting is deferred."
            )
        if response.status_code >= 400:
            raise IdentityAuthorityUnavailable(
                f"OneBrain identity authority error ({response.status_code})."
            )

        body = response.json()
        account_id = str(body.get("account_id") or "").strip()
        user_id = str(body.get("user_id") or "").strip()
        if not account_id or not user_id:
            raise IdentityAuthorityUnavailable(
                "OneBrain identity response is missing account or user identity."
            )
        return ResolvedIdentity(
            account_id=account_id,
            user_id=user_id,
            space_id=str(body.get("space_id") or "").strip()
            or self._settings.onebrain_space_id,
            identity_source="onebrain",
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
    """Select the identity provider. ``stub`` for local/test, OneBrain otherwise."""
    if settings.resolved_auth_identity_mode == "stub":
        return StubIdentityProvider(settings)
    return OneBrainIdentityProvider(settings)
