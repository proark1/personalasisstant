from __future__ import annotations

from datetime import UTC, datetime

import httpx

from assistant_runtime.providers.reliability import (
    ProviderFailureClass,
    ProviderRequestError,
    ProviderRetryPolicy,
    parse_retry_after,
    provider_request,
)
from assistant_runtime.schemas import ProviderKind


async def _no_sleep(_: float) -> None:
    return None


def test_parse_retry_after_accepts_seconds_and_http_date() -> None:
    seconds = parse_retry_after("120")
    http_date = parse_retry_after("Thu, 09 Jul 2026 14:00:00 GMT")

    assert seconds is not None
    assert http_date == datetime(2026, 7, 9, 14, 0, tzinfo=UTC)


def test_google_usage_limit_403_classifies_as_throttled() -> None:
    async def _run() -> None:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    403,
                    json={
                        "error": {
                            "errors": [{"reason": "rateLimitExceeded"}],
                            "code": 403,
                        }
                    },
                )
            )
        ) as client:
            try:
                await provider_request(
                    client,
                    "GET",
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                    provider=ProviderKind.google,
                    service="gmail_messages",
                    retry_policy=ProviderRetryPolicy(
                        max_attempts=1,
                        sleep=_no_sleep,
                    ),
                )
            except ProviderRequestError as exc:
                assert exc.failure_class == ProviderFailureClass.throttled
                assert exc.retryable is True
                return
        raise AssertionError("expected provider request error")

    import asyncio

    asyncio.run(_run())


def test_provider_request_retries_transient_failure_then_succeeds() -> None:
    calls = {"count": 0}

    def _handler(_: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(500, json={"error": "temporary"})
        return httpx.Response(200, json={"ok": True})

    async def _run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(_handler)) as client:
            response = await provider_request(
                client,
                "GET",
                "https://graph.microsoft.com/v1.0/me/messages",
                provider=ProviderKind.microsoft,
                service="microsoft_messages",
                retry_policy=ProviderRetryPolicy(
                    max_attempts=2,
                    initial_delay_seconds=0,
                    jitter_seconds=0,
                    sleep=_no_sleep,
                ),
            )
            assert response.status_code == 200

    import asyncio

    asyncio.run(_run())
    assert calls["count"] == 2
