from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from assistant_runtime.domain.sessions import hash_session_token
from assistant_runtime.schemas import AuthPrincipal, ScopedIdentity

if TYPE_CHECKING:
    from assistant_runtime.api.app import RuntimeContainer

# auto_error=False so a missing/malformed header yields a consistent 401 (not FastAPI's
# default 403) and the OpenAPI contract still advertises the bearer security scheme.
_bearer_scheme = HTTPBearer(auto_error=False, description="Assistant session bearer token")

_UNAUTHENTICATED = HTTPException(
    status_code=401,
    detail="Authentication required.",
    headers={"WWW-Authenticate": "Bearer"},
)


def _container(request: Request) -> RuntimeContainer:
    return request.app.state.container


async def require_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> AuthPrincipal:
    """Resolve a bearer token to a verified principal, or raise 401.

    OneBrain owns identity; this only enforces that a caller presents a valid,
    non-expired, non-revoked assistant session and derives its OneBrain-scoped identity.
    """
    if credentials is None or not credentials.credentials:
        raise _UNAUTHENTICATED

    container = _container(request)
    session = container.sessions.get_active_session_by_token_hash(
        hash_session_token(credentials.credentials)
    )
    if session is None:
        raise _UNAUTHENTICATED

    container.sessions.touch(session.session_id)
    return AuthPrincipal(
        session_id=session.session_id,
        scope=session.scope,
        identity_source=session.identity_source,
        expires_at=session.expires_at,
        last_used_at=session.last_used_at,
    )


def require_scope_match(principal: AuthPrincipal, scope: ScopedIdentity) -> None:
    """Guard cross-account access: the target scope must match the principal's account/space."""
    if (
        scope.account_id != principal.scope.account_id
        or scope.space_id != principal.scope.space_id
    ):
        # Do not leak existence of another account's resource.
        raise HTTPException(status_code=404, detail="Not found.")
