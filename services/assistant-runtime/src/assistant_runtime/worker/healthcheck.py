from __future__ import annotations

from assistant_runtime.config import get_settings
from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.worker.runner import AssistantWorker


def main() -> None:
    settings = get_settings()
    AssistantWorker(
        worker_id="healthcheck",
        actions=InMemoryActionStore(),
        outbox=InMemoryOutboxStore(),
        queue=InMemoryQueueProvider(),
        policy=AssistantActionPolicyEngine(),
        onebrain_available=settings.onebrain_available,
    )


if __name__ == "__main__":
    main()
