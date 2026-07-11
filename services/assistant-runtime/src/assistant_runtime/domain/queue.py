from __future__ import annotations

from datetime import datetime, timedelta
from threading import RLock
from uuid import UUID
from zoneinfo import ZoneInfo

from assistant_runtime.schemas import JobRecord, JobState, ScopedIdentity, utc_now


class InMemoryQueueProvider:
    def __init__(self, lease_seconds: int = 60, max_retries: int = 3) -> None:
        self.lease_seconds = lease_seconds
        self.max_retries = max_retries
        self._lock = RLock()
        self._jobs: dict[UUID, JobRecord] = {}
        self._idempotency_index: dict[str, UUID] = {}

    def enqueue(self, job: JobRecord) -> JobRecord:
        with self._lock:
            existing_id = self._idempotency_index.get(job.idempotency_key)
            if existing_id:
                return self._jobs[existing_id]
            self._jobs[job.job_id] = job
            self._idempotency_index[job.idempotency_key] = job.job_id
            return job

    def lease_next(self, worker_id: str, now: datetime | None = None) -> JobRecord | None:
        now = now or utc_now()
        with self._lock:
            for job in sorted(self._jobs.values(), key=lambda item: item.run_at):
                state = JobState(job.state)
                lease_expired = job.lease_expires_at is not None and job.lease_expires_at <= now
                runnable = state in {JobState.queued, JobState.retry_wait} and job.run_at <= now
                reclaimable = state in {JobState.leased, JobState.running} and lease_expired
                if runnable or reclaimable:
                    job.state = JobState.leased
                    job.lease_owner = worker_id
                    job.lease_expires_at = now + timedelta(seconds=self.lease_seconds)
                    job.updated_at = now
                    return job
            return None

    def mark_succeeded(self, job_id: UUID) -> JobRecord:
        with self._lock:
            job = self._jobs[job_id]
            job.state = JobState.succeeded
            job.lease_owner = None
            job.lease_expires_at = None
            job.updated_at = utc_now()
            return job

    def mark_retry_or_dead_letter(self, job_id: UUID, reason: str) -> JobRecord:
        with self._lock:
            job = self._jobs[job_id]
            job.retry_count += 1
            job.last_error = reason
            job.lease_owner = None
            job.lease_expires_at = None
            if job.retry_count >= self.max_retries:
                job.state = JobState.dead_lettered
            else:
                job.state = JobState.retry_wait
                job.run_at = utc_now() + timedelta(seconds=2**job.retry_count)
            job.updated_at = utc_now()
            return job

    def all(self) -> list[JobRecord]:
        with self._lock:
            return list(self._jobs.values())

    def purge_scope(
        self,
        account_id: str,
        space_id: str = "",
        keep_job_types: set[str] | frozenset[str] = frozenset(),
    ) -> int:
        """Erase jobs for a tombstoned scope. Empty space = whole account.

        ``keep_job_types`` preserves platform maintenance chains (e.g. the OneBrain
        tombstone poller) that must outlive the scope they clean up after.
        """
        with self._lock:
            doomed = [
                job_id
                for job_id, job in self._jobs.items()
                if job.scope.account_id == account_id
                and (not space_id or job.scope.space_id == space_id)
                and job.job_type not in keep_job_types
            ]
            for job_id in doomed:
                job = self._jobs.pop(job_id)
                self._idempotency_index.pop(job.idempotency_key, None)
            return len(doomed)


class InMemorySchedulerProvider:
    def __init__(self, queue: InMemoryQueueProvider) -> None:
        self.queue = queue

    def schedule_local_time(
        self,
        scope: ScopedIdentity,
        job_type: str,
        local_time: str,
        timezone_name: str,
        now: datetime | None = None,
        payload_ref: str | None = None,
    ) -> JobRecord:
        now = now or utc_now()
        hour, minute = [int(part) for part in local_time.split(":", 1)]
        zone = ZoneInfo(timezone_name)
        local_now = now.astimezone(zone)
        run_local = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if run_local <= local_now:
            run_local += timedelta(days=1)
        run_at = run_local.astimezone(ZoneInfo("UTC"))
        job = JobRecord(
            scope=scope,
            job_type=job_type,
            payload_ref=payload_ref or f"onebrain://scheduled-job/{job_type}",
            idempotency_key=f"{scope.account_id}:{scope.user_id}:{job_type}:{run_local.date()}",
            timezone=timezone_name,
            run_at=run_at,
        )
        return self.queue.enqueue(job)
