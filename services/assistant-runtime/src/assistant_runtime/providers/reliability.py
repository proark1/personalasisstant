from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from assistant_runtime.schemas import (
    ProviderFailureClass,
    ProviderKind,
    ProviderOperationalSyncStatus,
    utc_now,
)


@dataclass(frozen=True)
class ProviderRetryPolicy:
    max_attempts: int = 3
    initial_delay_seconds: float = 0.2
    max_backoff_seconds: float = 2.0
    max_inline_delay_seconds: float = 1.0
    jitter_seconds: float = 0.2
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep


class ProviderRequestError(RuntimeError):
    def __init__(
        self,
        detail: str,
        *,
        provider: ProviderKind,
        service: str,
        failure_class: ProviderFailureClass,
        retryable: bool,
        status_code: int | None = None,
        retry_after: datetime | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.provider = ProviderKind(provider)
        self.service = service
        self.failure_class = failure_class
        self.retryable = retryable
        self.status_code = status_code
        self.retry_after = retry_after


async def provider_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    provider: ProviderKind,
    service: str,
    retry_policy: ProviderRetryPolicy | None = None,
    **kwargs: Any,
) -> httpx.Response:
    policy = retry_policy or ProviderRetryPolicy()
    last_error: ProviderRequestError | None = None
    attempts = max(1, policy.max_attempts)
    for attempt in range(attempts):
        try:
            response = await client.request(method, url, **kwargs)
        except httpx.HTTPError:
            last_error = ProviderRequestError(
                f"{_provider_label(provider)} {service} request failed transiently.",
                provider=provider,
                service=service,
                failure_class=ProviderFailureClass.transient,
                retryable=True,
            )
        else:
            if response.status_code < 400:
                return response
            last_error = classify_provider_response(
                response,
                provider=provider,
                service=service,
            )

        if not last_error.retryable or attempt >= attempts - 1:
            raise last_error

        delay = _retry_delay(last_error, attempt, policy)
        if delay > policy.max_inline_delay_seconds:
            raise last_error
        await policy.sleep(delay)

    if last_error is not None:
        raise last_error
    raise ProviderRequestError(
        f"{_provider_label(provider)} {service} request failed.",
        provider=provider,
        service=service,
        failure_class=ProviderFailureClass.transient,
        retryable=True,
    )


def classify_provider_response(
    response: httpx.Response,
    *,
    provider: ProviderKind,
    service: str,
) -> ProviderRequestError:
    provider = ProviderKind(provider)
    status_code = response.status_code
    retry_after = parse_retry_after(response.headers.get("Retry-After"))
    if provider == ProviderKind.microsoft:
        return _classify_microsoft_response(
            status_code,
            provider=provider,
            service=service,
            retry_after=retry_after,
        )
    return _classify_google_response(
        response,
        provider=provider,
        service=service,
        retry_after=retry_after,
    )


def parse_retry_after(value: str | None) -> datetime | None:
    if value is None or not value.strip():
        return None
    raw = value.strip()
    if raw.isdigit():
        return utc_now() + timedelta(seconds=max(0, int(raw)))
    try:
        parsed = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return None
    return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def sync_status_for_failure(
    failure_class: ProviderFailureClass | str | None,
) -> ProviderOperationalSyncStatus:
    if failure_class == ProviderFailureClass.throttled:
        return ProviderOperationalSyncStatus.throttled
    if failure_class == ProviderFailureClass.auth:
        return ProviderOperationalSyncStatus.auth_required
    if failure_class in {
        ProviderFailureClass.transient,
        ProviderFailureClass.provider_unavailable,
        ProviderFailureClass.cursor_expired,
    }:
        return ProviderOperationalSyncStatus.stale
    return ProviderOperationalSyncStatus.degraded


def sanitized_failure_detail(error: ProviderRequestError) -> str:
    status = f" HTTP {error.status_code}" if error.status_code is not None else ""
    return f"{_provider_label(error.provider)} {error.service} {error.failure_class}{status}."


def _classify_microsoft_response(
    status_code: int,
    *,
    provider: ProviderKind,
    service: str,
    retry_after: datetime | None,
) -> ProviderRequestError:
    if service == "token_refresh" and status_code in {400, 401, 403}:
        return _error(provider, service, ProviderFailureClass.auth, status_code, None)
    if status_code == 429:
        return _error(provider, service, ProviderFailureClass.throttled, status_code, retry_after)
    if status_code in {401, 403}:
        return _error(provider, service, ProviderFailureClass.auth, status_code, None)
    if status_code in {503, 509}:
        return _error(
            provider,
            service,
            ProviderFailureClass.provider_unavailable,
            status_code,
            retry_after,
        )
    if status_code in {500, 502, 504}:
        return _error(provider, service, ProviderFailureClass.transient, status_code, retry_after)
    if service.endswith("_delta") and status_code in {400, 404, 410}:
        return _error(provider, service, ProviderFailureClass.cursor_expired, status_code, None)
    return _error(provider, service, ProviderFailureClass.permanent, status_code, None)


def _classify_google_response(
    response: httpx.Response,
    *,
    provider: ProviderKind,
    service: str,
    retry_after: datetime | None,
) -> ProviderRequestError:
    status_code = response.status_code
    reason = _google_error_reason(response)
    if service == "token_refresh" and status_code in {400, 401, 403}:
        return _error(provider, service, ProviderFailureClass.auth, status_code, None)
    if status_code == 429 or reason in {
        "rateLimitExceeded",
        "userRateLimitExceeded",
        "quotaExceeded",
    }:
        return _error(provider, service, ProviderFailureClass.throttled, status_code, retry_after)
    if status_code in {401, 403}:
        if reason in {"dailyLimitExceeded"}:
            return _error(
                provider,
                service,
                ProviderFailureClass.throttled,
                status_code,
                retry_after,
                retryable=False,
            )
        return _error(provider, service, ProviderFailureClass.auth, status_code, None)
    if service == "gmail_history" and status_code == 404:
        return _error(provider, service, ProviderFailureClass.cursor_expired, status_code, None)
    if status_code in {500, 502, 503, 504}:
        failure_class = (
            ProviderFailureClass.provider_unavailable
            if status_code == 503
            else ProviderFailureClass.transient
        )
        return _error(provider, service, failure_class, status_code, retry_after)
    return _error(provider, service, ProviderFailureClass.permanent, status_code, None)


def _google_error_reason(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return ""
    error = payload.get("error") if isinstance(payload, dict) else None
    if not isinstance(error, dict):
        return ""
    errors = error.get("errors")
    if isinstance(errors, list):
        for item in errors:
            if isinstance(item, dict) and item.get("reason"):
                return str(item["reason"])
    reason = error.get("reason") or error.get("status")
    return str(reason or "")


def _error(
    provider: ProviderKind,
    service: str,
    failure_class: ProviderFailureClass,
    status_code: int,
    retry_after: datetime | None,
    *,
    retryable: bool | None = None,
) -> ProviderRequestError:
    if retryable is None:
        retryable = failure_class in {
            ProviderFailureClass.throttled,
            ProviderFailureClass.transient,
            ProviderFailureClass.provider_unavailable,
        }
    return ProviderRequestError(
        f"{_provider_label(provider)} {service} request failed.",
        provider=provider,
        service=service,
        failure_class=failure_class,
        retryable=retryable,
        status_code=status_code,
        retry_after=retry_after,
    )


def _retry_delay(
    error: ProviderRequestError,
    attempt: int,
    policy: ProviderRetryPolicy,
) -> float:
    if error.retry_after is not None:
        return max(0.0, (error.retry_after - utc_now()).total_seconds())
    base = min(
        policy.initial_delay_seconds * (2**attempt),
        policy.max_backoff_seconds,
    )
    jitter = random.uniform(0, policy.jitter_seconds) if policy.jitter_seconds > 0 else 0.0
    return min(base + jitter, policy.max_backoff_seconds)


def _provider_label(provider: ProviderKind) -> str:
    return "Google" if ProviderKind(provider) == ProviderKind.google else "Microsoft"
