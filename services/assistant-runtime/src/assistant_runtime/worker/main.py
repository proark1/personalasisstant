from __future__ import annotations

import logging
import os
import time

from assistant_runtime.config import get_settings
from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.logging import configure_logging
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.worker.runner import AssistantWorker

logger = logging.getLogger(__name__)


def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    worker = AssistantWorker(
        worker_id=os.getenv("WORKER_ID", "assistant-worker-local"),
        actions=InMemoryActionStore(),
        outbox=InMemoryOutboxStore(),
        queue=InMemoryQueueProvider(),
        policy=AssistantActionPolicyEngine(),
        onebrain_available=settings.onebrain_available,
    )
    if os.getenv("RUN_ONCE", "false").lower() == "true":
        result = worker.run_once()
        logger.info("worker run once complete", extra={"extra": result.__dict__})
        return

    logger.info("assistant worker started", extra={"extra": {"service": "assistant-worker"}})
    while True:
        result = worker.run_once()
        logger.info("worker tick", extra={"extra": result.__dict__})
        time.sleep(float(os.getenv("WORKER_POLL_SECONDS", "5")))


if __name__ == "__main__":
    run()
