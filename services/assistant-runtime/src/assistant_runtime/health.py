from __future__ import annotations

import asyncio

from assistant_runtime.config import Settings
from assistant_runtime.providers.onebrain import build_brain_client


def dependency_checks(settings: Settings) -> dict[str, str]:
    checks: dict[str, str] = {}
    if settings.use_postgres_operational_store:
        checks["postgres_schema"] = _check_postgres_schema(settings.database_url)
        checks["redis"] = _check_redis(settings.redis_url)
    else:
        checks["postgres_schema"] = "memory"
        checks["redis"] = "not_required"
    checks["onebrain"] = "configured" if settings.onebrain_available else "unavailable"
    return checks


def assert_worker_dependencies(settings: Settings) -> None:
    checks = dependency_checks(settings)
    try:
        checks["onebrain"] = (
            "ok" if asyncio.run(build_brain_client(settings).check_available()) else "unavailable"
        )
    except RuntimeError:
        checks["onebrain"] = "error:event_loop"
    failed = {
        name: status
        for name, status in checks.items()
        if status.startswith("error")
    }
    if failed:
        details = "; ".join(f"{name}={status}" for name, status in sorted(failed.items()))
        raise RuntimeError(f"Worker dependency check failed: {details}")


def _check_postgres_schema(database_url: str) -> str:
    try:
        import psycopg

        with psycopg.connect(database_url, connect_timeout=2) as conn:
            exists = conn.execute("SELECT to_regclass('assistant_actions')").fetchone()[0]
    except Exception as exc:
        return f"error:{exc.__class__.__name__}"
    return "ok" if exists == "assistant_actions" else "error:schema_missing"


def _check_redis(redis_url: str) -> str:
    try:
        from redis import Redis

        client = Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        return "ok" if client.ping() else "error:ping_failed"
    except Exception as exc:
        return f"error:{exc.__class__.__name__}"
