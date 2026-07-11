from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from assistant_runtime.channels.telegram import TelegramChannel, safe_telegram_delivery_error
from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.interfaces import BrainClient, SecretProvider, SessionStore
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.providers.morning_brief import MorningBriefProcessor
from assistant_runtime.providers.onebrain_events import record_telegram_event
from assistant_runtime.providers.read_adapters import ProviderReadClient
from assistant_runtime.providers.sync import ProviderSyncProcessor
from assistant_runtime.providers.token_refresh import ProviderTokenRefresher
from assistant_runtime.providers.tombstones import TombstoneConsumer
from assistant_runtime.providers.workday import WorkdayJobProcessor
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
        telegram: TelegramChannel | None = None,
        providers: InMemoryProviderStore | None = None,
        secrets: SecretProvider | None = None,
        brain: BrainClient | None = None,
        provider_reader: ProviderReadClient | None = None,
        token_refresher: ProviderTokenRefresher | None = None,
        sessions: SessionStore | None = None,
        tombstone_poll_seconds: int = 300,
        onebrain_available: bool = True,
    ) -> None:
        self.worker_id = worker_id
        self.actions = actions
        self.outbox = outbox
        self.queue = queue
        self.policy = policy
        self.telegram = telegram
        self.providers = providers
        self.secrets = secrets
        self.brain = brain
        self.provider_reader = provider_reader or ProviderReadClient()
        self.token_refresher = token_refresher
        self.sessions = sessions
        self.onebrain_available = onebrain_available
        self.tombstones = TombstoneConsumer(
            brain=brain,
            actions=actions,
            outbox=outbox,
            queue=queue,
            providers=providers,
            sessions=sessions,
            secrets=secrets,
            telegram=telegram,
            poll_seconds=tombstone_poll_seconds,
        )
        self.provider_sync = (
            ProviderSyncProcessor(
                providers,
                brain=brain,
                secrets=secrets,
                reader=self.provider_reader,
                token_refresher=token_refresher,
            )
            if providers is not None
            else None
        )
        self.workday_jobs = WorkdayJobProcessor(brain=brain, providers=providers)
        self.morning_brief = (
            MorningBriefProcessor(
                brain=brain,
                providers=providers,
                telegram=telegram,
                outbox=outbox,
                queue=queue,
            )
            if telegram is not None
            else None
        )

    def run_once(self) -> WorkerResult:
        result = WorkerResult()
        result.outbox_processed += self._relay_one_outbox()
        job = self.queue.lease_next(self.worker_id)
        if job is not None:
            try:
                if self.provider_sync is not None and self.provider_sync.can_process(job):
                    self.provider_sync.process(job)
                elif self.morning_brief is not None and self.morning_brief.can_process(job):
                    self.morning_brief.process(job)
                elif self.tombstones.can_process(job):
                    self.tombstones.process(job)
                elif self.workday_jobs.can_process(job):
                    self.workday_jobs.process(job)
                self.queue.mark_succeeded(job.job_id)
                result.jobs_processed += 1
            except Exception as exc:
                self.queue.mark_retry_or_dead_letter(job.job_id, exc.__class__.__name__)
                result.blocked += 1
        return result

    def _relay_one_outbox(self) -> int:
        row = self.outbox.lease_next(self.worker_id)
        if row is None:
            return 0
        if row.effect_type == "telegram.message.send":
            return self._relay_telegram_outbox(row)

        action = self.actions.get(row.action_id) if row.action_id is not None else None
        if action is not None:
            decision = self.policy.evaluate(
                action,
                channel="worker",
                onebrain_available=self._onebrain_available(),
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

    def _relay_telegram_outbox(self, row: OutboxRow) -> int:
        if self.telegram is None:
            self.outbox.mark_retry_or_dead_letter(row.outbox_id, "Telegram channel unavailable.")
            return 0
        try:
            provider_response_ref = asyncio.run(self.telegram.deliver_outbox_row(row))
        except Exception as exc:
            self.outbox.mark_retry_or_dead_letter(
                row.outbox_id,
                safe_telegram_delivery_error(exc),
            )
            return 0
        self._record_telegram_delivery_provenance(row)
        self.outbox.mark_delivered(row.outbox_id, provider_response_ref=provider_response_ref)
        return 1

    def _onebrain_available(self) -> bool:
        if self.brain is None:
            return self.onebrain_available
        return _safe_check_onebrain_available(self.brain)

    def _record_telegram_delivery_provenance(self, row: OutboxRow) -> None:
        if self.brain is None or self.telegram is None:
            return
        event = self.telegram.get_event_by_source_update(
            f"telegram://update/{row.outbox_id}",
            "telegram.message.delivered",
        )
        if event is None:
            return
        try:
            asyncio.run(record_telegram_event(self.brain, event))
        except Exception as exc:
            logger.warning(
                "onebrain telegram delivery provenance write failed",
                extra={"extra": {"error_class": exc.__class__.__name__}},
            )


def _provider_response_ref(row: OutboxRow) -> str:
    return f"onebrain://provider-response/{row.outbox_id}"


def _safe_check_onebrain_available(brain: BrainClient) -> bool:
    try:
        return asyncio.run(brain.check_available())
    except Exception:
        return False
