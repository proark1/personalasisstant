from __future__ import annotations

import asyncio

from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.workday import WorkdayLoopProcessor
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import JobRecord


class WorkdayJobProcessor:
    def __init__(
        self,
        *,
        brain: BrainClient | None,
        providers: InMemoryProviderStore | None = None,
    ) -> None:
        self.processor = WorkdayLoopProcessor(brain=brain, providers=providers)

    def can_process(self, job: JobRecord) -> bool:
        return job.job_type.startswith("workday.")

    def process(self, job: JobRecord) -> None:
        local_date = _local_date_from_payload_ref(job.payload_ref)
        asyncio.run(
            self.processor.generate_snapshot(
                scope=job.scope,
                local_date=local_date,
                require_durable=True,
            )
        )


def _local_date_from_payload_ref(payload_ref: str) -> str | None:
    prefix = "workday://"
    if not payload_ref.startswith(prefix):
        return None
    value = payload_ref.removeprefix(prefix).strip("/")
    return value or None
