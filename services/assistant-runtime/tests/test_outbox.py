from datetime import timedelta

from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.schemas import ActionCreateRequest, OutboxState, utc_now


def test_outbox_row_is_idempotent_and_leased_once() -> None:
    actions = InMemoryActionStore()
    outbox = InMemoryOutboxStore()
    action = actions.create(ActionCreateRequest(idempotency_key="outbox-demo"))

    row = outbox.create_for_action(action, "action.execution.requested", "onebrain://snapshot/1")
    duplicate = outbox.create_for_action(
        action, "action.execution.requested", "onebrain://snapshot/1"
    )

    assert duplicate.outbox_id == row.outbox_id

    leased = outbox.lease_next("worker-1")
    assert leased is not None
    assert leased.outbox_id == row.outbox_id
    assert OutboxState(leased.state) == OutboxState.leased

    assert outbox.lease_next("worker-2") is None

    delivered = outbox.mark_delivered(leased.outbox_id, "onebrain://provider-response/1")
    assert OutboxState(delivered.state) == OutboxState.delivered


def test_outbox_retries_then_dead_letters() -> None:
    actions = InMemoryActionStore()
    outbox = InMemoryOutboxStore(max_retries=2)
    action = actions.create(ActionCreateRequest(idempotency_key="dead-letter-demo"))
    outbox.create_for_action(action, "action.execution.requested", "onebrain://snapshot/2")

    leased = outbox.lease_next("worker-1")
    assert leased is not None

    retry = outbox.mark_retry_or_dead_letter(leased.outbox_id, "Transient provider error.")
    assert OutboxState(retry.state) == OutboxState.retry_wait

    second_lease = outbox.lease_next("worker-1", now=utc_now() + timedelta(seconds=10))
    assert second_lease is not None

    dead = outbox.mark_retry_or_dead_letter(second_lease.outbox_id, "Repeated provider error.")
    assert OutboxState(dead.state) == OutboxState.dead_lettered
