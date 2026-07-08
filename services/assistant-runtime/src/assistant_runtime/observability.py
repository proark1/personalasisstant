from __future__ import annotations

import contextvars
from collections import Counter
from collections.abc import Callable
from time import perf_counter
from uuid import uuid4

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Histogram,
    generate_latest,
)
from prometheus_client import (
    Counter as PromCounter,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="unknown"
)

HTTP_REQUESTS = PromCounter(
    "assistant_http_requests_total",
    "HTTP requests handled by the assistant API",
    ["path", "method", "status"],
)
HTTP_LATENCY = Histogram(
    "assistant_http_request_seconds", "HTTP request latency", ["path", "method"]
)
MODEL_USAGE = PromCounter(
    "assistant_model_usage_total",
    "Model usage events by task and cost class",
    ["task", "cost_class"],
)
PROVIDER_ERRORS = PromCounter(
    "assistant_provider_errors_total",
    "Provider errors by provider and class",
    ["provider", "error_class"],
)


def current_request_id() -> str:
    return request_id_var.get()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid4()))
        token = request_id_var.set(request_id)
        started = perf_counter()
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)

        elapsed = perf_counter() - started
        response.headers["x-request-id"] = request_id
        HTTP_REQUESTS.labels(request.url.path, request.method, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.url.path, request.method).observe(elapsed)
        return response


class InMemoryObservabilityProvider:
    def __init__(self) -> None:
        self.counters: Counter[str] = Counter()

    def increment(self, metric_name: str, labels: dict[str, str] | None = None) -> None:
        label_text = ",".join(f"{key}={value}" for key, value in sorted((labels or {}).items()))
        self.counters[f"{metric_name}:{label_text}"] += 1

    def record_model_usage(self, task: str, cost_class: str) -> None:
        MODEL_USAGE.labels(task, cost_class).inc()
        self.increment("model_usage", {"task": task, "cost_class": cost_class})

    def record_provider_error(self, provider: str, error_class: str) -> None:
        PROVIDER_ERRORS.labels(provider, error_class).inc()
        self.increment("provider_error", {"provider": provider, "error_class": error_class})


def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
