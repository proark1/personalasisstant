from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

import httpx

from assistant_runtime.config import Settings
from assistant_runtime.schemas import (
    OAuthScopeTier,
    ProviderConfigurationStatus,
    ProviderKind,
    ProviderService,
    utc_now,
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"

GOOGLE_GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly"
GOOGLE_GMAIL_METADATA = "https://www.googleapis.com/auth/gmail.metadata"
GOOGLE_CALENDAR_READONLY = "https://www.googleapis.com/auth/calendar.readonly"
GOOGLE_GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose"
GOOGLE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send"
GOOGLE_CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events"

MICROSOFT_OFFLINE_ACCESS = "offline_access"
MICROSOFT_USER_READ = "User.Read"
MICROSOFT_MAIL_READ = "Mail.Read"
MICROSOFT_CALENDARS_READ = "Calendars.Read"
MICROSOFT_MAIL_READWRITE = "Mail.ReadWrite"
MICROSOFT_MAIL_SEND = "Mail.Send"
MICROSOFT_CALENDARS_READWRITE = "Calendars.ReadWrite"


@dataclass(frozen=True)
class OAuthProviderConfig:
    provider: ProviderKind
    client_id: str
    client_secret: str
    redirect_uri: str
    tenant_id: str = "common"

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


class OAuthExchangeError(RuntimeError):
    pass


class ProviderOAuthClient:
    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings
        self.transport = transport

    def configuration(self, provider: ProviderKind) -> OAuthProviderConfig:
        provider = ProviderKind(provider)
        if provider == ProviderKind.google:
            return OAuthProviderConfig(
                provider=provider,
                client_id=self.settings.google_oauth_client_id,
                client_secret=self.settings.google_oauth_client_secret,
                redirect_uri=self.settings.google_oauth_redirect_uri,
            )
        return OAuthProviderConfig(
            provider=provider,
            client_id=self.settings.microsoft_oauth_client_id,
            client_secret=self.settings.microsoft_oauth_client_secret,
            redirect_uri=self.settings.microsoft_oauth_redirect_uri,
            tenant_id=self.settings.microsoft_tenant_id,
        )

    def provider_statuses(self) -> list[ProviderConfigurationStatus]:
        return [
            configuration_status(self.settings, ProviderKind.google),
            configuration_status(self.settings, ProviderKind.microsoft),
        ]

    def authorization_url(
        self,
        provider: ProviderKind,
        state: str,
        scopes: list[str],
    ) -> str:
        config = self.configuration(provider)
        if not config.configured:
            raise OAuthExchangeError(f"{provider} OAuth is not configured.")

        if ProviderKind(provider) == ProviderKind.google:
            params = {
                "client_id": config.client_id,
                "redirect_uri": config.redirect_uri,
                "response_type": "code",
                "scope": " ".join(scopes),
                "state": state,
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
            }
            return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

        params = {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": " ".join(scopes),
            "state": state,
        }
        auth_url = MICROSOFT_AUTH_URL.format(tenant=config.tenant_id or "common")
        return f"{auth_url}?{urlencode(params)}"

    async def exchange_code(self, provider: ProviderKind, code: str) -> dict[str, Any]:
        provider = ProviderKind(provider)
        config = self.configuration(provider)
        if not config.configured:
            raise OAuthExchangeError(f"{provider} OAuth is not configured.")
        if _is_local_test_code(code):
            return _local_token_response(
                provider,
                code,
                scopes_for(provider, OAuthScopeTier.read_only),
            )

        token_url = _token_url(config)
        payload = {
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "code": code,
            "redirect_uri": config.redirect_uri,
            "grant_type": "authorization_code",
        }
        try:
            async with httpx.AsyncClient(timeout=10, transport=self.transport) as client:
                response = await client.post(token_url, data=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OAuthExchangeError("Provider token exchange failed.") from exc
        token = dict(response.json())
        token.setdefault("scope", " ".join(scopes_for(provider, OAuthScopeTier.read_only)))
        token.setdefault("provider_subject", f"{provider}:{_short_hash(str(token))}")
        return token


def new_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def hash_oauth_state(state: str) -> str:
    return hashlib.sha256(f"provider-oauth-state:{state}".encode()).hexdigest()


def oauth_attempt_expiry(seconds: int = 600):
    return utc_now() + timedelta(seconds=seconds)


def scopes_for(
    provider: ProviderKind,
    tier: OAuthScopeTier,
    services: list[ProviderService] | None = None,
) -> list[str]:
    provider = ProviderKind(provider)
    tier = OAuthScopeTier(tier)
    services = services or [ProviderService.mail, ProviderService.calendar]
    normalized_services = {ProviderService(service) for service in services}

    if provider == ProviderKind.google:
        scopes: list[str] = []
        if ProviderService.mail in normalized_services:
            scopes.append(GOOGLE_GMAIL_READONLY)
        if ProviderService.calendar in normalized_services:
            scopes.append(GOOGLE_CALENDAR_READONLY)
        if tier in {OAuthScopeTier.draft_write, OAuthScopeTier.send}:
            scopes.append(GOOGLE_GMAIL_COMPOSE)
        if tier == OAuthScopeTier.send:
            scopes.append(GOOGLE_GMAIL_SEND)
        if tier == OAuthScopeTier.calendar_write:
            scopes.append(GOOGLE_CALENDAR_EVENTS)
        return _dedupe(scopes)

    scopes = [MICROSOFT_OFFLINE_ACCESS, MICROSOFT_USER_READ]
    if ProviderService.mail in normalized_services:
        scopes.append(MICROSOFT_MAIL_READ)
    if ProviderService.calendar in normalized_services:
        scopes.append(MICROSOFT_CALENDARS_READ)
    if tier in {OAuthScopeTier.draft_write, OAuthScopeTier.send}:
        scopes.append(MICROSOFT_MAIL_READWRITE)
    if tier == OAuthScopeTier.send:
        scopes.append(MICROSOFT_MAIL_SEND)
    if tier == OAuthScopeTier.calendar_write:
        scopes.append(MICROSOFT_CALENDARS_READWRITE)
    return _dedupe(scopes)


def upgrade_scopes_for(provider: ProviderKind) -> dict[str, list[str]]:
    return {
        OAuthScopeTier.draft_write.value: scopes_for(provider, OAuthScopeTier.draft_write),
        OAuthScopeTier.send.value: scopes_for(provider, OAuthScopeTier.send),
        OAuthScopeTier.calendar_write.value: scopes_for(provider, OAuthScopeTier.calendar_write),
    }


def missing_read_scopes(provider: ProviderKind, granted_scopes: list[str]) -> list[str]:
    granted = set(granted_scopes)
    return [
        scope for scope in scopes_for(provider, OAuthScopeTier.read_only) if scope not in granted
    ]


def configuration_status(settings: Settings, provider: ProviderKind) -> ProviderConfigurationStatus:
    provider = ProviderKind(provider)
    if provider == ProviderKind.google:
        missing = []
        if not settings.google_oauth_client_id:
            missing.append("GOOGLE_OAUTH_CLIENT_ID")
        if not settings.google_oauth_client_secret:
            missing.append("GOOGLE_OAUTH_CLIENT_SECRET")
        return ProviderConfigurationStatus(
            provider=provider,
            display_name="Google Workspace",
            configured=not missing,
            missing_config=missing,
            read_scopes=scopes_for(provider, OAuthScopeTier.read_only),
            upgrade_scopes=upgrade_scopes_for(provider),
        )

    missing = []
    if not settings.microsoft_oauth_client_id:
        missing.append("MICROSOFT_OAUTH_CLIENT_ID")
    if not settings.microsoft_oauth_client_secret:
        missing.append("MICROSOFT_OAUTH_CLIENT_SECRET")
    return ProviderConfigurationStatus(
        provider=provider,
        display_name="Microsoft 365",
        configured=not missing,
        missing_config=missing,
        read_scopes=scopes_for(provider, OAuthScopeTier.read_only),
        upgrade_scopes=upgrade_scopes_for(provider),
    )


def token_subject(provider: ProviderKind, token_payload: dict[str, Any]) -> str:
    subject = str(
        token_payload.get("provider_subject")
        or token_payload.get("id_token")
        or token_payload.get("refresh_token")
        or token_payload.get("access_token")
        or ""
    )
    return f"{provider}:{_short_hash(subject)}"


def token_email(provider: ProviderKind, token_payload: dict[str, Any]) -> str:
    return str(
        token_payload.get("email") or f"{ProviderKind(provider).value}-account@example.local"
    )


def token_display_name(provider: ProviderKind, token_payload: dict[str, Any]) -> str:
    return str(token_payload.get("name") or _display_name(provider))


def token_scopes(provider: ProviderKind, token_payload: dict[str, Any]) -> list[str]:
    raw = token_payload.get("scope")
    if isinstance(raw, str) and raw.strip():
        return _dedupe(raw.split())
    if isinstance(raw, list):
        return _dedupe([str(item) for item in raw])
    return scopes_for(provider, OAuthScopeTier.read_only)


def token_expires_at(token_payload: dict[str, Any]):
    expires_in = token_payload.get("expires_in")
    if isinstance(expires_in, int | float):
        return utc_now() + timedelta(seconds=int(expires_in))
    return None


def _token_url(config: OAuthProviderConfig) -> str:
    if config.provider == ProviderKind.microsoft:
        return MICROSOFT_TOKEN_URL.format(tenant=config.tenant_id or "common")
    return GOOGLE_TOKEN_URL


def _is_local_test_code(code: str) -> bool:
    return code.startswith("local_") or code.startswith("test_")


def _local_token_response(
    provider: ProviderKind,
    code: str,
    scopes: list[str],
) -> dict[str, Any]:
    subject = f"{provider}:{_short_hash(code)}"
    return {
        "access_token": f"local-access-{_short_hash(code)}",
        "refresh_token": f"local-refresh-{_short_hash(code)}",
        "expires_in": 3600,
        "scope": " ".join(scopes),
        "provider_subject": subject,
        "email": f"{provider.value}-{_short_hash(code)}@example.local",
        "name": _display_name(provider),
    }


def _display_name(provider: ProviderKind) -> str:
    return (
        "Google account" if ProviderKind(provider) == ProviderKind.google else "Microsoft account"
    )


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:12]


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
