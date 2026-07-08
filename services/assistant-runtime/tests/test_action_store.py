from assistant_runtime.domain.action_store import InMemoryActionStore, InvalidActionTransition
from assistant_runtime.schemas import ActionCreateRequest, ActionState, ApprovalChannel


def test_action_state_machine_and_cross_channel_deduplication() -> None:
    store = InMemoryActionStore()
    request = ActionCreateRequest(idempotency_key="state-machine-demo")

    action = store.create(request)
    duplicate = store.create(request)

    assert duplicate.action_id == action.action_id
    assert ActionState(action.state) == ActionState.proposed

    reviewed = store.transition(
        action.action_id,
        ActionState.needs_review,
        actor="assistant-api",
        reason="Missing review context.",
    )
    assert ActionState(reviewed.state) == ActionState.needs_review

    approved = store.approve(
        action.action_id,
        actor="user_demo",
        channel=ApprovalChannel.web,
        reason="Approved in web.",
    )
    second_approval = store.approve(
        action.action_id,
        actor="user_demo",
        channel=ApprovalChannel.telegram,
        reason="Duplicate callback.",
    )
    assert ActionState(approved.state) == ActionState.approved
    assert second_approval.action_id == approved.action_id
    assert len(second_approval.transitions) == len(approved.transitions)

    executing = store.begin_execution(action.action_id, "worker-1")
    assert ActionState(executing.state) == ActionState.executing

    executed = store.mark_executed(action.action_id, "worker-1")
    assert ActionState(executed.state) == ActionState.executed


def test_failed_action_can_be_retried_or_cancelled() -> None:
    store = InMemoryActionStore()
    action = store.create(ActionCreateRequest(idempotency_key="failure-demo"))

    store.approve(action.action_id, "user_demo", ApprovalChannel.web, "Approved.")
    store.begin_execution(action.action_id, "worker-1")
    failed = store.mark_failed(action.action_id, "worker-1", "Provider timeout.")
    assert ActionState(failed.state) == ActionState.failed

    retried = store.approve(action.action_id, "user_demo", ApprovalChannel.web, "Retry.")
    assert ActionState(retried.state) == ActionState.approved

    cancelled = store.cancel(action.action_id, "user_demo", "User cancelled retry.")
    assert ActionState(cancelled.state) == ActionState.cancelled


def test_terminal_state_rejects_execution_retry() -> None:
    store = InMemoryActionStore()
    action = store.create(ActionCreateRequest(idempotency_key="terminal-demo"))
    store.cancel(action.action_id, "user_demo", "No longer needed.")

    try:
        store.begin_execution(action.action_id, "worker-1")
    except InvalidActionTransition as exc:
        assert "cancelled" in str(exc)
    else:
        raise AssertionError("cancelled action should not execute")
