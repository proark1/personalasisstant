from __future__ import annotations

from datetime import UTC, datetime
from threading import RLock
from uuid import UUID

from assistant_runtime.schemas import (
    ActionCreateRequest,
    ActionRecord,
    ActionState,
    ApprovalChannel,
    TransitionRecord,
    utc_now,
)

ALLOWED_TRANSITIONS: dict[ActionState, set[ActionState]] = {
    ActionState.proposed: {ActionState.needs_review, ActionState.approved, ActionState.cancelled},
    ActionState.needs_review: {ActionState.approved, ActionState.cancelled},
    ActionState.approved: {ActionState.executing, ActionState.cancelled},
    ActionState.executing: {ActionState.executed, ActionState.failed},
    ActionState.failed: {ActionState.approved, ActionState.cancelled},
    ActionState.executed: set(),
    ActionState.cancelled: set(),
}


class InvalidActionTransition(ValueError):
    pass


class InMemoryActionStore:
    """Phase 0 state machine with idempotency and cross-channel approval dedupe."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._actions: dict[UUID, ActionRecord] = {}
        self._idempotency_index: dict[str, UUID] = {}

    def create(self, request: ActionCreateRequest) -> ActionRecord:
        idempotency_key = request.idempotency_key or (
            f"{request.scope.account_id}:{request.scope.user_id}:{request.action_type}:"
            f"{request.risk_tier}:{request.summary}"
        )
        with self._lock:
            existing_id = self._idempotency_index.get(idempotency_key)
            if existing_id:
                return self._actions[existing_id]

            action = ActionRecord(
                scope=request.scope,
                action_type=request.action_type,
                risk_tier=request.risk_tier,
                summary=request.summary,
                idempotency_key=idempotency_key,
                sending_account_ref=request.sending_account_ref,
                recipient_refs=request.recipient_refs,
                source_refs=request.source_refs,
                changed_fields=request.changed_fields,
                sensitive_flags=request.sensitive_flags,
                reversible=request.reversible,
                external_side_effect=request.external_side_effect,
                transitions=[
                    TransitionRecord(
                        from_state=None,
                        to_state=ActionState.proposed,
                        actor="assistant-api",
                        reason="Action proposed from sanitized input or trusted user intent.",
                        correlation_id=idempotency_key,
                    )
                ],
            )
            self._actions[action.action_id] = action
            self._idempotency_index[idempotency_key] = action.action_id
            return action

    def get(self, action_id: UUID) -> ActionRecord | None:
        with self._lock:
            return self._actions.get(action_id)

    def transition(
        self,
        action_id: UUID,
        to_state: ActionState,
        actor: str,
        reason: str,
        channel: ApprovalChannel | None = None,
    ) -> ActionRecord:
        with self._lock:
            action = self._actions[action_id]
            current_state = ActionState(action.state)
            if to_state == current_state:
                return action
            if to_state not in ALLOWED_TRANSITIONS[current_state]:
                raise InvalidActionTransition(f"{current_state} -> {to_state} is not allowed")

            action.transitions.append(
                TransitionRecord(
                    from_state=current_state,
                    to_state=to_state,
                    actor=actor,
                    channel=channel,
                    reason=reason,
                    correlation_id=action.correlation_id,
                )
            )
            action.state = to_state
            action.updated_at = utc_now()
            return action

    def approve(
        self, action_id: UUID, actor: str, channel: ApprovalChannel, reason: str
    ) -> ActionRecord:
        with self._lock:
            action = self._actions[action_id]
            current_state = ActionState(action.state)
            if current_state in {
                ActionState.approved,
                ActionState.executing,
                ActionState.executed,
            }:
                return action
            return self.transition(action_id, ActionState.approved, actor, reason, channel)

    def begin_execution(self, action_id: UUID, worker_id: str) -> ActionRecord:
        return self.transition(
            action_id,
            ActionState.executing,
            worker_id,
            "Worker claimed approved action for idempotent execution.",
            ApprovalChannel.worker,
        )

    def mark_executed(self, action_id: UUID, worker_id: str) -> ActionRecord:
        return self.transition(
            action_id,
            ActionState.executed,
            worker_id,
            "Provider confirmed execution.",
            ApprovalChannel.worker,
        )

    def mark_failed(self, action_id: UUID, worker_id: str, reason: str) -> ActionRecord:
        return self.transition(
            action_id, ActionState.failed, worker_id, reason, ApprovalChannel.worker
        )

    def cancel(self, action_id: UUID, actor: str, reason: str) -> ActionRecord:
        return self.transition(action_id, ActionState.cancelled, actor, reason)

    def all(self) -> list[ActionRecord]:
        with self._lock:
            return list(self._actions.values())


def stale_after(seconds: int) -> datetime:
    return datetime.now(UTC).replace(microsecond=0)
