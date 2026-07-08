from __future__ import annotations

from assistant_runtime.config import get_settings
from assistant_runtime.health import assert_worker_dependencies
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.runtime_stores import build_operational_stores
from assistant_runtime.worker.runner import AssistantWorker


def main() -> None:
    settings = get_settings()
    assert_worker_dependencies(settings)
    operational = build_operational_stores(settings)
    AssistantWorker(
        worker_id="healthcheck",
        actions=operational.actions,
        outbox=operational.outbox,
        queue=operational.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=operational.telegram,
        onebrain_available=settings.onebrain_available,
    )


if __name__ == "__main__":
    main()
