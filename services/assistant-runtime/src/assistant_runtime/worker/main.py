from __future__ import annotations

import asyncio
import logging
import os
import time

from assistant_runtime.config import get_settings
from assistant_runtime.health import assert_worker_dependencies
from assistant_runtime.logging import configure_logging
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.providers.onebrain import build_brain_client
from assistant_runtime.runtime_stores import build_operational_stores
from assistant_runtime.worker.runner import AssistantWorker

logger = logging.getLogger(__name__)


def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    assert_worker_dependencies(settings)
    operational = build_operational_stores(settings)
    brain = build_brain_client(settings)
    worker = AssistantWorker(
        worker_id=os.getenv("WORKER_ID", "assistant-worker-local"),
        actions=operational.actions,
        outbox=operational.outbox,
        queue=operational.queue,
        policy=AssistantActionPolicyEngine(),
        telegram=operational.telegram,
        brain=brain,
        onebrain_available=asyncio.run(brain.check_available()),
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
