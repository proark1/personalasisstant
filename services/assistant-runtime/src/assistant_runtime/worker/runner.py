from __future__ import annotations

import logging
from dataclasses import dataclass

from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.schemas import ActionState, OutboxRow

logger = logging.getLogger(__name__)


@dataclass
class WorkerResult:
    outbox_processed: int = 0
    jobs_processed: int = 0
    blocked: int = 0


class AssistantWorker:
    def __init__(
        self,
        worker_id: str,
        actions: InMemoryActionStore,
        outbox: InMemoryOutboxStore,
        queue: InMemoryQueueProvider,
        policy: AssistantActionPolicyEngine,
        onebrain_available: bool = True,
    ) -> None:
        self.worker_id = worker_id
        self.actions = actions
        self.outbox = outbox
        self.queue = queue
        self.policy = policy
        self.onebrain_available = onebrain_available

    def run_once(self) -> WorkerResult:
        result = WorkerResult()
        result.outbox_processed += self._relay_one_outbox()
        job = self.queue.lease_next(self.worker_id)
        if job is not None:
            self.queue.mark_succeeded(job.job_id)
            result.jobs_processed += 1
        return result

    def _relay_one_outbox(self) -> int:
        row = self.outbox.lease_next(self.worker_id)
        if row is None:
            return 0
        action = self.actions.get(row.action_id) if row.action_id is not None else None
        if action is not None:
            decision = self.policy.evaluate(
                action,
                channel="worker",
                onebrain_available=self.onebrain_available,
            )
            if not decision.allowed:
                self.outbox.mark_retry_or_dead_letter(
                    row.outbox_id, "; ".join(decision.blocked_reasons)
                )
                return 0
            if ActionState(action.state) == ActionState.approved:
                self.actions.begin_execution(action.action_id, self.worker_id)
                self.actions.mark_executed(action.action_id, self.worker_id)
        self.outbox.mark_delivered(row.outbox_id, provider_response_ref=_provider_response_ref(row))
        return 1


def _provider_response_ref(row: OutboxRow) -> str:
    return f"onebrain://provider-response/{row.outbox_id}"
