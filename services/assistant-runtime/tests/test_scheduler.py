from datetime import UTC, datetime, timedelta

from assistant_runtime.domain.queue import InMemoryQueueProvider, InMemorySchedulerProvider
from assistant_runtime.schemas import JobState, ScopedIdentity


def test_timezone_aware_schedule_uses_user_local_time() -> None:
    queue = InMemoryQueueProvider()
    scheduler = InMemorySchedulerProvider(queue)
    scope = ScopedIdentity(account_id="acct", user_id="user", space_id="space")
    now = datetime(2026, 7, 8, 6, 0, tzinfo=UTC)

    job = scheduler.schedule_local_time(scope, "morning_brief", "09:00", "Europe/Berlin", now)

    assert JobState(job.state) == JobState.queued
    assert job.run_at == datetime(2026, 7, 8, 7, 0, tzinfo=UTC)
    assert job.timezone == "Europe/Berlin"


def test_scheduler_rolls_past_local_time_to_next_day() -> None:
    queue = InMemoryQueueProvider()
    scheduler = InMemorySchedulerProvider(queue)
    scope = ScopedIdentity(account_id="acct", user_id="user", space_id="space")
    now = datetime(2026, 7, 8, 8, 0, tzinfo=UTC)

    job = scheduler.schedule_local_time(scope, "morning_brief", "09:00", "Europe/Berlin", now)

    assert job.run_at == datetime(2026, 7, 9, 7, 0, tzinfo=UTC)


def test_queue_retries_then_dead_letters_jobs() -> None:
    queue = InMemoryQueueProvider(max_retries=2)
    scheduler = InMemorySchedulerProvider(queue)
    scope = ScopedIdentity(account_id="acct", user_id="user", space_id="space")
    now = datetime(2026, 7, 8, 6, 0, tzinfo=UTC)
    scheduler.schedule_local_time(scope, "morning_brief", "08:01", "Europe/Berlin", now)

    leased = queue.lease_next("worker-1", now=now + timedelta(minutes=2))
    assert leased is not None

    retry = queue.mark_retry_or_dead_letter(leased.job_id, "Transient model timeout.")
    assert JobState(retry.state) == JobState.retry_wait

    second_lease = queue.lease_next("worker-1", now=retry.run_at + timedelta(seconds=1))
    assert second_lease is not None

    dead = queue.mark_retry_or_dead_letter(second_lease.job_id, "Repeated model timeout.")
    assert JobState(dead.state) == JobState.dead_lettered
