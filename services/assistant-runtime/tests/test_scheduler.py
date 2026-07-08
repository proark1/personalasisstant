from datetime import UTC, datetime

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
