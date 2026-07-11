from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from uuid import uuid4

from assistant_runtime.channels.telegram import TelegramChannel
from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.interfaces import BrainClient, SecretProvider, SessionStore
from assistant_runtime.providers.onebrain import OneBrainClientError
from assistant_runtime.schemas import JobRecord, JsonObject, ScopedIdentity, utc_now
from assistant_runtime.secrets.provider import SecretNotFound

logger = logging.getLogger(__name__)

TOMBSTONE_POLL_JOB_TYPE = "onebrain.tombstones.poll"
_PAYLOAD_PREFIX = "onebrain-tombstones://poll/"
DEFAULT_POLL_SECONDS = 300


class TombstoneConsumer:
    """Consume OneBrain's deletion tombstone feed and mirror it locally.

    OneBrain is the deletion authority; the assistant is a required consumer. For
    every tombstone this worker erases the matching operational state (sessions,
    actions, outbox rows, jobs, provider accounts/cursors/subscriptions, Telegram
    bindings), revokes the secrets those rows referenced, and acks the tombstone.
    A deletion is not complete platform-wide until every required consumer acks,
    so apply-then-ack ordering is load-bearing: a crash between the two re-applies
    an idempotent purge instead of losing the deletion.
    """

    def __init__(
        self,
        *,
        brain: BrainClient | None,
        actions: InMemoryActionStore,
        outbox: InMemoryOutboxStore,
        queue: InMemoryQueueProvider,
        providers: InMemoryProviderStore | None = None,
        sessions: SessionStore | None = None,
        secrets: SecretProvider | None = None,
        telegram: TelegramChannel | None = None,
        poll_seconds: int = DEFAULT_POLL_SECONDS,
    ) -> None:
        self.brain = brain
        self.actions = actions
        self.outbox = outbox
        self.queue = queue
        self.providers = providers
        self.sessions = sessions
        self.secrets = secrets
        self.telegram = telegram
        self.poll_seconds = poll_seconds

    def can_process(self, job: JobRecord) -> bool:
        return job.job_type == TOMBSTONE_POLL_JOB_TYPE

    def process(self, job: JobRecord) -> None:
        try:
            self._poll_and_apply(job.scope)
        except OneBrainClientError as exc:
            # OneBrain being unreachable must not dead-letter the poll chain; the
            # unacked tombstones stay on the feed and the next poll retries them.
            logger.warning(
                "onebrain tombstone poll skipped",
                extra={"extra": {"status": exc.status_code, "detail": exc.detail}},
            )
        finally:
            self._reschedule(job)

    def ensure_scheduled(self, scope: ScopedIdentity) -> JobRecord | None:
        """Start the poll chain if no live poll job exists for this scope."""
        live_states = {"queued", "leased", "running", "retry_wait"}
        for existing in self.queue.all():
            if (
                existing.job_type == TOMBSTONE_POLL_JOB_TYPE
                and existing.scope.account_id == scope.account_id
                and str(existing.state) in live_states
            ):
                return None
        job = JobRecord(
            scope=scope,
            job_type=TOMBSTONE_POLL_JOB_TYPE,
            payload_ref=f"{_PAYLOAD_PREFIX}{self.poll_seconds}",
            idempotency_key=f"onebrain-tombstones:{scope.account_id}:{uuid4()}",
            timezone="UTC",
            run_at=utc_now(),
        )
        return self.queue.enqueue(job)

    def _poll_and_apply(self, scope: ScopedIdentity) -> None:
        if self.brain is None or self.providers is None:
            return
        cursor = self.providers.get_onebrain_tombstone_cursor(scope.account_id)
        feed = asyncio.run(self.brain.list_tombstones(since=cursor, limit=100))
        tombstones = sorted(
            (dict(row) for row in feed.get("tombstones") or []),
            key=lambda row: int(row.get("seq") or 0),
        )
        for tombstone in tombstones:
            self._apply(tombstone)
            self._ack(tombstone)
            self.providers.set_onebrain_tombstone_cursor(
                scope.account_id, int(tombstone.get("seq") or 0)
            )

    def _apply(self, tombstone: JsonObject) -> None:
        account_id = str(tombstone.get("account_id") or "").strip()
        target_type = str(tombstone.get("target_type") or "").strip()
        if not account_id:
            return
        if target_type == "account":
            self._purge(account_id, "")
        elif target_type == "space":
            space_id = str(tombstone.get("space_id") or tombstone.get("target_ref") or "").strip()
            if space_id:
                self._purge(account_id, space_id)
        else:
            # document/conversation/contact/subject: the assistant keeps no durable
            # per-record business content (OneBrain owns it), so there is nothing
            # narrower than a scope to erase locally. Ack so the deletion completes.
            logger.info(
                "onebrain tombstone has no local operational copy",
                extra={"extra": {"target_type": target_type, "account_id": account_id}},
            )

    def _purge(self, account_id: str, space_id: str) -> None:
        secret_refs: list[str] = []
        counts = {
            "actions": self.actions.purge_scope(account_id, space_id),
            "outbox": self.outbox.purge_scope(account_id, space_id),
            "jobs": self.queue.purge_scope(
                account_id, space_id, keep_job_types=frozenset({TOMBSTONE_POLL_JOB_TYPE})
            ),
        }
        if self.sessions is not None:
            counts["sessions"] = self.sessions.purge_scope(account_id, space_id)
        if self.providers is not None:
            secret_refs.extend(self.providers.purge_scope(account_id, space_id))
        if self.telegram is not None:
            secret_refs.extend(self.telegram.bindings.purge_scope(account_id, space_id))
        counts["secrets_revoked"] = self._revoke_secrets(secret_refs)
        logger.info(
            "onebrain tombstone applied",
            extra={"extra": {"account_id": account_id, "space_id": space_id, **counts}},
        )

    def _revoke_secrets(self, secret_refs: list[str]) -> int:
        if self.secrets is None:
            return 0
        revoked = 0
        for secret_ref in dict.fromkeys(secret_refs):
            try:
                self.secrets.revoke_secret(secret_ref)
                revoked += 1
            except SecretNotFound:
                continue
        return revoked

    def _ack(self, tombstone: JsonObject) -> None:
        if self.brain is None:
            return
        tombstone_id = str(tombstone.get("id") or "")
        try:
            asyncio.run(self.brain.ack_tombstone(tombstone_id))
        except OneBrainClientError as exc:
            if exc.status_code == 404:
                # Unknown-for-account acks are treated as already settled.
                return
            raise

    def _reschedule(self, job: JobRecord) -> None:
        interval = _poll_interval(job.payload_ref, self.poll_seconds)
        next_run = utc_now() + timedelta(seconds=interval)
        self.queue.enqueue(
            JobRecord(
                scope=job.scope,
                job_type=TOMBSTONE_POLL_JOB_TYPE,
                payload_ref=f"{_PAYLOAD_PREFIX}{interval}",
                idempotency_key=(
                    f"onebrain-tombstones:{job.scope.account_id}:{next_run.isoformat()}"
                ),
                timezone="UTC",
                run_at=next_run,
                correlation_id=job.correlation_id,
            )
        )


def _poll_interval(payload_ref: str, default_seconds: int) -> int:
    if payload_ref.startswith(_PAYLOAD_PREFIX):
        value = payload_ref.removeprefix(_PAYLOAD_PREFIX).strip("/")
        try:
            return max(30, int(value))
        except ValueError:
            pass
    return default_seconds
