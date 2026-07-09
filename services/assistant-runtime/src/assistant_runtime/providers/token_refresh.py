from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import httpx

from assistant_runtime.config import Settings
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.interfaces import SecretProvider
from assistant_runtime.providers.oauth import (
    GOOGLE_TOKEN_URL,
    MICROSOFT_TOKEN_URL,
    ProviderOAuthClient,
    token_expires_at,
)
from assistant_runtime.schemas import ProviderAccountRecord, ProviderKind, utc_now


class ProviderTokenRefreshError(RuntimeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


@dataclass(frozen=True)
class ProviderTokenRefreshResult:
    account: ProviderAccountRecord
    token_payload: dict[str, Any]
    refreshed: bool = False


class ProviderTokenRefresher:
    def __init__(
        self,
        settings: Settings,
        secrets: SecretProvider,
        providers: InMemoryProviderStore,
        *,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
        refresh_margin: timedelta = timedelta(minutes=5),
    ) -> None:
        self.settings = settings
        self.secrets = secrets
        self.providers = providers
        self.timeout_seconds = timeout_seconds
        self.transport = transport
        self.refresh_margin = refresh_margin
        self.oauth = ProviderOAuthClient(settings)

    async def token_for_read(
        self,
        account: ProviderAccountRecord,
    ) -> ProviderTokenRefreshResult:
        token_payload = self._load_token_payload(account.refresh_token_secret_ref)
        if _is_local_test_token_payload(token_payload) or not self._should_refresh(account):
            return ProviderTokenRefreshResult(account=account, token_payload=token_payload)

        refresh_token = str(token_payload.get("refresh_token") or "")
        if not refresh_token:
            raise ProviderTokenRefreshError("Provider refresh token is unavailable.")

        provider = ProviderKind(account.provider)
        config = self.oauth.configuration(provider)
        if not config.configured:
            raise ProviderTokenRefreshError("Provider OAuth refresh is not configured.")

        form = {
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        if provider == ProviderKind.microsoft:
            scope = token_payload.get("scope")
            if isinstance(scope, str) and scope.strip():
                form["scope"] = scope

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.post(_token_url(provider, config.tenant_id), data=form)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderTokenRefreshError("Provider token refresh failed.") from exc

        rotated_payload = _merge_token_payload(token_payload, response.json())
        old_secret_ref = account.refresh_token_secret_ref
        new_secret_ref = self.secrets.store_secret(
            json.dumps(rotated_payload),
            f"{provider}-oauth-token",
        )
        updated_account = self.providers.update_account_token(
            account.provider_account_id,
            refresh_token_secret_ref=new_secret_ref,
            token_expires_at=token_expires_at(rotated_payload),
        )
        if new_secret_ref != old_secret_ref:
            _safe_revoke_secret(self.secrets, old_secret_ref)
        return ProviderTokenRefreshResult(
            account=updated_account,
            token_payload=rotated_payload,
            refreshed=True,
        )

    def _load_token_payload(self, secret_ref: str) -> dict[str, Any]:
        try:
            payload = json.loads(self.secrets.retrieve_secret(secret_ref))
        except Exception as exc:
            raise ProviderTokenRefreshError("Provider token secret is unavailable.") from exc
        if not isinstance(payload, dict):
            raise ProviderTokenRefreshError("Provider token secret is malformed.")
        return payload

    def _should_refresh(self, account: ProviderAccountRecord) -> bool:
        if account.token_expires_at is None:
            return False
        return account.token_expires_at <= utc_now() + self.refresh_margin


def _token_url(provider: ProviderKind, tenant_id: str) -> str:
    if provider == ProviderKind.microsoft:
        return MICROSOFT_TOKEN_URL.format(tenant=tenant_id or "common")
    return GOOGLE_TOKEN_URL


def _merge_token_payload(
    current_payload: dict[str, Any],
    refresh_payload: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(current_payload)
    for key, value in refresh_payload.items():
        if value is not None:
            merged[key] = value
    if not merged.get("refresh_token"):
        merged["refresh_token"] = current_payload.get("refresh_token")
    return merged


def _is_local_test_token_payload(token_payload: dict[str, Any]) -> bool:
    token_values = [
        str(token_payload.get("access_token") or ""),
        str(token_payload.get("refresh_token") or ""),
    ]
    return any(
        value.startswith("local-") or value.startswith("test-") for value in token_values
    )


def _safe_revoke_secret(secrets: SecretProvider, secret_ref: str) -> None:
    try:
        secrets.revoke_secret(secret_ref)
    except Exception:
        return
