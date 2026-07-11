from __future__ import annotations

from datetime import UTC, datetime, timedelta
from threading import RLock
from uuid import UUID

from assistant_runtime.schemas import ActionRecord, OutboxRow, OutboxState, ScopedIdentity, utc_now


class InMemoryOutboxStore:
    """Transactional outbox baseline.

    The in-memory implementation is for tests and local skeleton behavior. The
    migration defines the Postgres tables that must back this in production.
    """

    def __init__(self, max_retries: int = 3, lease_seconds: int = 60) -> None:
        self.max_retries = max_retries
        self.lease_seconds = lease_seconds
        self._lock = RLock()
        self._rows: dict[UUID, OutboxRow] = {}
        self._idempotency_index: dict[str, UUID] = {}

    def purge_scope(self, account_id: str, space_id: str = "") -> int:
        """Erase all outbox rows for a tombstoned scope. Empty space = whole account."""
        with self._lock:
            doomed = [
                outbox_id
                for outbox_id, row in self._rows.items()
                if row.scope.account_id == account_id
                and (not space_id or row.scope.space_id == space_id)
            ]
            for outbox_id in doomed:
                row = self._rows.pop(outbox_id)
                self._idempotency_index.pop(row.idempotency_key, None)
            return len(doomed)

    def create_for_action(
        self, action: ActionRecord, effect_type: str, payload_ref: str
    ) -> OutboxRow:
        idempotency_key = f"{action.idempotency_key}:{effect_type}"
        return self.create(
            scope=action.scope,
            effect_type=effect_type,
            payload_ref=payload_ref,
            idempotency_key=idempotency_key,
            correlation_id=action.correlation_id,
            audit_correlation_id=action.audit_correlation_id,
            action_id=action.action_id,
        )

    def create(
        self,
        scope: ScopedIdentity,
        effect_type: str,
        payload_ref: str,
        idempotency_key: str,
        correlation_id: str,
        audit_correlation_id: str,
        action_id: UUID | None = None,
    ) -> OutboxRow:
        with self._lock:
            existing_id = self._idempotency_index.get(idempotency_key)
            if existing_id:
                return self._rows[existing_id]

            row = OutboxRow(
                scope=scope,
                action_id=action_id,
                effect_type=effect_type,
                payload_ref=payload_ref,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
                audit_correlation_id=audit_correlation_id,
            )
            self._rows[row.outbox_id] = row
            self._idempotency_index[idempotency_key] = row.outbox_id
            return row

    def lease_next(self, worker_id: str, now: datetime | None = None) -> OutboxRow | None:
        now = now or utc_now()
        with self._lock:
            candidates = sorted(self._rows.values(), key=lambda row: row.created_at)
            for row in candidates:
                state = OutboxState(row.state)
                lease_expired = row.lease_expires_at is not None and row.lease_expires_at <= now
                runnable = (
                    state in {OutboxState.pending, OutboxState.retry_wait}
                    and row.next_run_at <= now
                )
                reclaimable = state == OutboxState.leased and lease_expired
                if runnable or reclaimable:
                    row.state = OutboxState.leased
                    row.lease_owner = worker_id
                    row.lease_expires_at = now + timedelta(seconds=self.lease_seconds)
                    row.updated_at = now
                    return row
            return None

    def mark_delivered(self, outbox_id: UUID, provider_response_ref: str) -> OutboxRow:
        with self._lock:
            row = self._rows[outbox_id]
            row.state = OutboxState.delivered
            row.payload_ref = provider_response_ref
            row.lease_owner = None
            row.lease_expires_at = None
            row.updated_at = utc_now()
            return row

    def mark_retry_or_dead_letter(self, outbox_id: UUID, reason: str) -> OutboxRow:
        with self._lock:
            row = self._rows[outbox_id]
            row.retry_count += 1
            row.last_error = reason
            row.lease_owner = None
            row.lease_expires_at = None
            if row.retry_count >= self.max_retries:
                row.state = OutboxState.dead_lettered
            else:
                row.state = OutboxState.retry_wait
                row.next_run_at = utc_now() + timedelta(seconds=2**row.retry_count)
            row.updated_at = utc_now()
            return row

    def all(self) -> list[OutboxRow]:
        with self._lock:
            return list(self._rows.values())


def is_lease_expired(row: OutboxRow, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return row.lease_expires_at is not None and row.lease_expires_at <= now
