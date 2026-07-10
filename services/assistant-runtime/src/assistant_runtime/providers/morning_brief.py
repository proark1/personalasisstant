from __future__ import annotations

import asyncio

from assistant_runtime.channels.telegram import TelegramChannel
from assistant_runtime.domain.brief import compose_brief_message
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.queue import InMemoryQueueProvider, InMemorySchedulerProvider
from assistant_runtime.domain.workday import WorkdayLoopProcessor
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import JobRecord

BRIEF_JOB_TYPE = "workday.brief.telegram"
_BRIEF_PAYLOAD_PREFIX = "workday-brief://"


class MorningBriefProcessor:
    """Generate the workday snapshot, deliver a concise brief to Telegram, reschedule.

    The brief is queued through the transactional outbox (never sent inline) and only
    to a verified, unpaused binding for the job's scope. After a run it re-schedules
    itself for the next day so a single schedule call produces a recurring brief.
    """

    def __init__(
        self,
        *,
        brain: BrainClient | None,
        providers: InMemoryProviderStore | None,
        telegram: TelegramChannel | None,
        outbox: InMemoryOutboxStore | None,
        queue: InMemoryQueueProvider | None,
    ) -> None:
        self.workday = WorkdayLoopProcessor(brain=brain, providers=providers)
        self.telegram = telegram
        self.outbox = outbox
        self.scheduler = InMemorySchedulerProvider(queue) if queue is not None else None

    def can_process(self, job: JobRecord) -> bool:
        return job.job_type == BRIEF_JOB_TYPE

    def process(self, job: JobRecord) -> None:
        snapshot = asyncio.run(
            self.workday.generate_snapshot(
                scope=job.scope,
                local_date=None,
                require_durable=False,
            )
        )
        if self.telegram is not None and self.outbox is not None:
            binding = self.telegram.verified_binding_for_scope(job.scope)
            if binding is not None:
                self.telegram.queue_binding_message(
                    binding,
                    compose_brief_message(snapshot),
                    idempotency_key=(
                        f"morning-brief:{job.scope.account_id}:{job.scope.user_id}"
                        f":{snapshot.local_date}"
                    ),
                    outbox=self.outbox,
                    event_type="telegram.brief.queued",
                    summary="Morning brief queued for Telegram delivery.",
                )
        self._reschedule_next_day(job)

    def _reschedule_next_day(self, job: JobRecord) -> None:
        if self.scheduler is None:
            return
        local_time = _brief_local_time(job.payload_ref)
        if local_time is None:
            return
        # Schedule the next occurrence relative to this job's own scheduled time, so a
        # daily brief advances one day per run (rescheduling off wall-clock would dedupe
        # to the same target date when the worker runs late).
        self.scheduler.schedule_local_time(
            job.scope,
            BRIEF_JOB_TYPE,
            local_time,
            job.timezone,
            now=job.run_at,
            payload_ref=job.payload_ref,
        )


def _brief_local_time(payload_ref: str) -> str | None:
    if not payload_ref.startswith(_BRIEF_PAYLOAD_PREFIX):
        return None
    value = payload_ref.removeprefix(_BRIEF_PAYLOAD_PREFIX).strip("/")
    return value or None
