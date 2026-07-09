from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

from cryptography.fernet import Fernet, InvalidToken

from assistant_runtime.channels.telegram import (
    InMemoryTelegramBindingStore,
    TelegramBindingNotFound,
)
from assistant_runtime.domain.action_store import (
    ALLOWED_TRANSITIONS,
    InMemoryActionStore,
    InvalidActionTransition,
)
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.providers.oauth import scopes_for
from assistant_runtime.schemas import (
    ActionCreateRequest,
    ActionRecord,
    ActionState,
    ApprovalChannel,
    JobRecord,
    JobState,
    OAuthConnectionAttemptRecord,
    OAuthConnectionStatus,
    OAuthScopeTier,
    OutboxRow,
    OutboxState,
    ProviderAccountRecord,
    ProviderAccountStatus,
    ProviderFailureClass,
    ProviderKind,
    ProviderOperationalSyncStatus,
    ProviderSubscriptionRecord,
    ProviderSyncState,
    ScopedIdentity,
    SecretEnvelope,
    SyncCursorRecord,
    TelegramBindingRecord,
    TelegramBindingStatus,
    TelegramDeliveryRecord,
    TelegramProvenanceEvent,
    TelegramWebhookResponse,
    TransitionRecord,
    utc_now,
)
from assistant_runtime.secrets.provider import SecretNotFound, derive_fernet_key


def _connect(database_url: str, autocommit: bool = True):
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(database_url, autocommit=autocommit, row_factory=dict_row)


def _json(value: Any):
    from psycopg.types.json import Json

    return Json(value)


class PostgresSecretProvider:
    """Encrypted secret provider persisted in assistant operational Postgres."""

    def __init__(self, database_url: str, master_key: str, key_version: str = "v1") -> None:
        self.database_url = database_url
        self._fernet = Fernet(derive_fernet_key(master_key))
        self.key_version = key_version

    def store_secret(self, plaintext: str, purpose: str) -> str:
        secret_ref = f"secret://assistant/{purpose}/{uuid4()}"
        ciphertext = self._fernet.encrypt(plaintext.encode()).decode()
        with _connect(self.database_url) as conn:
            conn.execute(
                """
                INSERT INTO assistant_secret_references (
                  secret_ref, purpose, encrypted_value, key_version, created_at
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (secret_ref, purpose, ciphertext, self.key_version, utc_now()),
            )
        return secret_ref

    def retrieve_secret(self, secret_ref: str) -> str:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                SELECT encrypted_value
                FROM assistant_secret_references
                WHERE secret_ref = %s AND revoked_at IS NULL
                """,
                (secret_ref,),
            ).fetchone()
            if row is None:
                raise SecretNotFound(secret_ref)
            conn.execute(
                """
                UPDATE assistant_secret_references
                SET last_used_at = %s
                WHERE secret_ref = %s
                """,
                (utc_now(), secret_ref),
            )
        try:
            return self._fernet.decrypt(row["encrypted_value"].encode()).decode()
        except InvalidToken as exc:
            raise SecretNotFound(secret_ref) from exc

    def revoke_secret(self, secret_ref: str) -> None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_secret_references
                SET revoked_at = %s
                WHERE secret_ref = %s
                RETURNING secret_ref
                """,
                (utc_now(), secret_ref),
            ).fetchone()
        if row is None:
            raise SecretNotFound(secret_ref)

    def envelope(self, secret_ref: str) -> SecretEnvelope:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                SELECT secret_ref, encrypted_value, key_version, created_at, last_used_at,
                       rotated_at, revoked_at
                FROM assistant_secret_references
                WHERE secret_ref = %s
                """,
                (secret_ref,),
            ).fetchone()
        if row is None:
            raise SecretNotFound(secret_ref)
        return SecretEnvelope(
            secret_ref=row["secret_ref"],
            ciphertext=row["encrypted_value"],
            key_version=row["key_version"],
            created_at=row["created_at"],
            last_used_at=row["last_used_at"],
            rotated_at=row["rotated_at"],
            revoked_at=row["revoked_at"],
        )


class PostgresActionStore(InMemoryActionStore):
    """Postgres-backed action state machine with the in-memory store interface."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def create(self, request: ActionCreateRequest) -> ActionRecord:
        idempotency_key = request.idempotency_key or (
            f"{request.scope.account_id}:{request.scope.user_id}:{request.action_type}:"
            f"{request.risk_tier}:{request.summary}"
        )
        with _connect(self.database_url, autocommit=False) as conn:
            existing = conn.execute(
                "SELECT * FROM assistant_actions WHERE idempotency_key = %s",
                (idempotency_key,),
            ).fetchone()
            if existing is not None:
                return _action_from_row(existing, _load_transitions(conn, existing["action_id"]))

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
            row = conn.execute(
                """
                INSERT INTO assistant_actions (
                  action_id, account_id, user_id, space_id, purpose, state, action_type,
                  risk_tier, summary, idempotency_key, correlation_id, audit_correlation_id,
                  sending_account_ref, recipient_refs, source_refs, changed_fields,
                  sensitive_flags, approval_reason, reversible, external_side_effect,
                  created_at, updated_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING *
                """,
                (
                    action.action_id,
                    action.scope.account_id,
                    action.scope.user_id,
                    action.scope.space_id,
                    action.scope.purpose,
                    action.state,
                    action.action_type,
                    action.risk_tier,
                    action.summary,
                    action.idempotency_key,
                    action.correlation_id,
                    action.audit_correlation_id,
                    action.sending_account_ref,
                    _json(action.recipient_refs),
                    _json(action.source_refs),
                    _json(action.changed_fields),
                    _json(action.sensitive_flags),
                    action.approval_reason,
                    action.reversible,
                    action.external_side_effect,
                    action.created_at,
                    action.updated_at,
                ),
            ).fetchone()
            _insert_transition(conn, action.action_id, action.transitions[0])
            return _action_from_row(row, _load_transitions(conn, action.action_id))

    def get(self, action_id: UUID) -> ActionRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_actions WHERE action_id = %s",
                (action_id,),
            ).fetchone()
            if row is None:
                return None
            return _action_from_row(row, _load_transitions(conn, action_id))

    def transition(
        self,
        action_id: UUID,
        to_state: ActionState,
        actor: str,
        reason: str,
        channel: ApprovalChannel | None = None,
    ) -> ActionRecord:
        with _connect(self.database_url, autocommit=False) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_actions WHERE action_id = %s FOR UPDATE",
                (action_id,),
            ).fetchone()
            if row is None:
                raise KeyError(action_id)
            return _transition_locked(conn, row, to_state, actor, reason, channel)

    def approve(
        self, action_id: UUID, actor: str, channel: ApprovalChannel, reason: str
    ) -> ActionRecord:
        with _connect(self.database_url, autocommit=False) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_actions WHERE action_id = %s FOR UPDATE",
                (action_id,),
            ).fetchone()
            if row is None:
                raise KeyError(action_id)
            current_state = ActionState(row["state"])
            if current_state in {
                ActionState.approved,
                ActionState.executing,
                ActionState.executed,
            }:
                return _action_from_row(row, _load_transitions(conn, action_id))
            return _transition_locked(conn, row, ActionState.approved, actor, reason, channel)

    def approve_with_outbox(
        self,
        action_id: UUID,
        actor: str,
        channel: ApprovalChannel,
        reason: str,
        effect_type: str,
        payload_ref: str,
    ) -> tuple[ActionRecord, OutboxRow]:
        with _connect(self.database_url, autocommit=False) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_actions WHERE action_id = %s FOR UPDATE",
                (action_id,),
            ).fetchone()
            if row is None:
                raise KeyError(action_id)

            current_state = ActionState(row["state"])
            if current_state in {
                ActionState.approved,
                ActionState.executing,
                ActionState.executed,
            }:
                action = _action_from_row(row, _load_transitions(conn, action_id))
            else:
                action = _transition_locked(conn, row, ActionState.approved, actor, reason, channel)

            outbox = _create_outbox_for_action_locked(conn, action, effect_type, payload_ref)
            return action, outbox

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
            action_id,
            ActionState.failed,
            worker_id,
            reason,
            ApprovalChannel.worker,
        )

    def cancel(self, action_id: UUID, actor: str, reason: str) -> ActionRecord:
        return self.transition(action_id, ActionState.cancelled, actor, reason)

    def all(self) -> list[ActionRecord]:
        with _connect(self.database_url) as conn:
            rows = conn.execute("SELECT * FROM assistant_actions ORDER BY created_at").fetchall()
            return [
                _action_from_row(row, _load_transitions(conn, row["action_id"])) for row in rows
            ]


class PostgresOutboxStore(InMemoryOutboxStore):
    """Postgres-backed transactional outbox with the in-memory store interface."""

    def __init__(self, database_url: str, max_retries: int = 3, lease_seconds: int = 60) -> None:
        self.database_url = database_url
        self.max_retries = max_retries
        self.lease_seconds = lease_seconds

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
        row = OutboxRow(
            scope=scope,
            action_id=action_id,
            effect_type=effect_type,
            payload_ref=payload_ref,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            audit_correlation_id=audit_correlation_id,
        )
        with _connect(self.database_url) as conn:
            inserted = conn.execute(
                """
                INSERT INTO assistant_outbox (
                  outbox_id, account_id, user_id, space_id, purpose, action_id, state,
                  effect_type, payload_ref, idempotency_key, correlation_id,
                  audit_correlation_id, next_run_at, created_at, updated_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING *
                """,
                (
                    row.outbox_id,
                    scope.account_id,
                    scope.user_id,
                    scope.space_id,
                    scope.purpose,
                    action_id,
                    row.state,
                    effect_type,
                    payload_ref,
                    idempotency_key,
                    correlation_id,
                    audit_correlation_id,
                    row.next_run_at,
                    row.created_at,
                    row.updated_at,
                ),
            ).fetchone()
            selected = inserted or conn.execute(
                "SELECT * FROM assistant_outbox WHERE idempotency_key = %s",
                (idempotency_key,),
            ).fetchone()
        return _outbox_from_row(selected)

    def lease_next(self, worker_id: str, now=None) -> OutboxRow | None:
        now = now or utc_now()
        lease_expires_at = now + timedelta(seconds=self.lease_seconds)
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                WITH candidate AS (
                  SELECT outbox_id
                  FROM assistant_outbox
                  WHERE (
                    state IN ('pending', 'retry_wait') AND next_run_at <= %s
                  ) OR (
                    state = 'leased' AND lease_expires_at IS NOT NULL AND lease_expires_at <= %s
                  )
                  ORDER BY created_at
                  FOR UPDATE SKIP LOCKED
                  LIMIT 1
                )
                UPDATE assistant_outbox
                SET state = 'leased',
                    lease_owner = %s,
                    lease_expires_at = %s,
                    updated_at = %s
                WHERE outbox_id IN (SELECT outbox_id FROM candidate)
                RETURNING *
                """,
                (now, now, worker_id, lease_expires_at, now),
            ).fetchone()
        return _outbox_from_row(row) if row else None

    def mark_delivered(self, outbox_id: UUID, provider_response_ref: str) -> OutboxRow:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_outbox
                SET state = 'delivered',
                    payload_ref = %s,
                    lease_owner = NULL,
                    lease_expires_at = NULL,
                    updated_at = %s
                WHERE outbox_id = %s
                RETURNING *
                """,
                (provider_response_ref, utc_now(), outbox_id),
            ).fetchone()
        return _outbox_from_row(row)

    def mark_retry_or_dead_letter(self, outbox_id: UUID, reason: str) -> OutboxRow:
        now = utc_now()
        with _connect(self.database_url) as conn:
            current = conn.execute(
                "SELECT retry_count FROM assistant_outbox WHERE outbox_id = %s",
                (outbox_id,),
            ).fetchone()
            retry_count = int(current["retry_count"]) + 1
            if retry_count >= self.max_retries:
                state = OutboxState.dead_lettered
                next_run_at = now
            else:
                state = OutboxState.retry_wait
                next_run_at = now + timedelta(seconds=2**retry_count)
            row = conn.execute(
                """
                UPDATE assistant_outbox
                SET state = %s,
                    retry_count = %s,
                    last_error = %s,
                    lease_owner = NULL,
                    lease_expires_at = NULL,
                    next_run_at = %s,
                    updated_at = %s
                WHERE outbox_id = %s
                RETURNING *
                """,
                (state, retry_count, reason, next_run_at, now, outbox_id),
            ).fetchone()
        return _outbox_from_row(row)

    def all(self) -> list[OutboxRow]:
        with _connect(self.database_url) as conn:
            rows = conn.execute("SELECT * FROM assistant_outbox ORDER BY created_at").fetchall()
        return [_outbox_from_row(row) for row in rows]


class PostgresJobStore:
    """Postgres-backed durable job queue with the in-memory queue interface."""

    def __init__(self, database_url: str, lease_seconds: int = 60, max_retries: int = 3) -> None:
        self.database_url = database_url
        self.lease_seconds = lease_seconds
        self.max_retries = max_retries

    def enqueue(self, job: JobRecord) -> JobRecord:
        with _connect(self.database_url) as conn:
            inserted = conn.execute(
                """
                INSERT INTO assistant_jobs (
                  job_id, account_id, user_id, space_id, purpose, state, job_type,
                  payload_ref, idempotency_key, correlation_id, audit_correlation_id,
                  timezone, run_at, created_at, updated_at
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING *
                """,
                (
                    job.job_id,
                    job.scope.account_id,
                    job.scope.user_id,
                    job.scope.space_id,
                    job.scope.purpose,
                    job.state,
                    job.job_type,
                    job.payload_ref,
                    job.idempotency_key,
                    job.correlation_id,
                    job.audit_correlation_id,
                    job.timezone,
                    job.run_at,
                    job.created_at,
                    job.updated_at,
                ),
            ).fetchone()
            selected = inserted or conn.execute(
                "SELECT * FROM assistant_jobs WHERE idempotency_key = %s",
                (job.idempotency_key,),
            ).fetchone()
        return _job_from_row(selected)

    def lease_next(self, worker_id: str, now=None) -> JobRecord | None:
        now = now or utc_now()
        lease_expires_at = now + timedelta(seconds=self.lease_seconds)
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                WITH candidate AS (
                  SELECT job_id
                  FROM assistant_jobs
                  WHERE (
                    state IN ('queued', 'retry_wait') AND run_at <= %s
                  ) OR (
                    state IN ('leased', 'running')
                    AND lease_expires_at IS NOT NULL
                    AND lease_expires_at <= %s
                  )
                  ORDER BY run_at
                  FOR UPDATE SKIP LOCKED
                  LIMIT 1
                )
                UPDATE assistant_jobs
                SET state = 'leased',
                    lease_owner = %s,
                    lease_expires_at = %s,
                    updated_at = %s
                WHERE job_id IN (SELECT job_id FROM candidate)
                RETURNING *
                """,
                (now, now, worker_id, lease_expires_at, now),
            ).fetchone()
        return _job_from_row(row) if row else None

    def mark_succeeded(self, job_id: UUID) -> JobRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_jobs
                SET state = 'succeeded',
                    lease_owner = NULL,
                    lease_expires_at = NULL,
                    updated_at = %s
                WHERE job_id = %s
                RETURNING *
                """,
                (utc_now(), job_id),
            ).fetchone()
        return _job_from_row(row)

    def mark_retry_or_dead_letter(self, job_id: UUID, reason: str) -> JobRecord:
        now = utc_now()
        with _connect(self.database_url) as conn:
            current = conn.execute(
                "SELECT retry_count FROM assistant_jobs WHERE job_id = %s",
                (job_id,),
            ).fetchone()
            retry_count = int(current["retry_count"]) + 1
            if retry_count >= self.max_retries:
                state = JobState.dead_lettered
                run_at = now
            else:
                state = JobState.retry_wait
                run_at = now + timedelta(seconds=2**retry_count)
            row = conn.execute(
                """
                UPDATE assistant_jobs
                SET state = %s,
                    retry_count = %s,
                    last_error = %s,
                    lease_owner = NULL,
                    lease_expires_at = NULL,
                    run_at = %s,
                    updated_at = %s
                WHERE job_id = %s
                RETURNING *
                """,
                (state, retry_count, reason, run_at, now, job_id),
            ).fetchone()
        return _job_from_row(row)

    def all(self) -> list[JobRecord]:
        with _connect(self.database_url) as conn:
            rows = conn.execute("SELECT * FROM assistant_jobs ORDER BY run_at").fetchall()
        return [_job_from_row(row) for row in rows]


class PostgresProviderStore:
    """Postgres-backed provider OAuth/account/sync state."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def create_oauth_attempt(
        self, attempt: OAuthConnectionAttemptRecord
    ) -> OAuthConnectionAttemptRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_provider_oauth_attempts (
                  connection_id, account_id, user_id, space_id, purpose, provider,
                  state_hash, requested_scope_tier, requested_scopes, requested_services,
                  redirect_uri, status, expires_at, correlation_id, audit_correlation_id,
                  created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    attempt.connection_id,
                    attempt.scope.account_id,
                    attempt.scope.user_id,
                    attempt.scope.space_id,
                    attempt.scope.purpose,
                    attempt.provider,
                    attempt.state_hash,
                    attempt.requested_scope_tier,
                    _json(attempt.requested_scopes),
                    _json(attempt.requested_services),
                    attempt.redirect_uri,
                    attempt.status,
                    attempt.expires_at,
                    attempt.correlation_id,
                    attempt.audit_correlation_id,
                    attempt.created_at,
                    attempt.updated_at,
                ),
            ).fetchone()
        return _oauth_attempt_from_row(row)

    def get_oauth_attempt_by_state(
        self, state_hash: str, now=None
    ) -> OAuthConnectionAttemptRecord | None:
        now = now or utc_now()
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_provider_oauth_attempts WHERE state_hash = %s",
                (state_hash,),
            ).fetchone()
            if row is None:
                return None
            if row["status"] == OAuthConnectionStatus.pending and row["expires_at"] <= now:
                row = conn.execute(
                    """
                    UPDATE assistant_provider_oauth_attempts
                    SET status = 'expired', updated_at = %s
                    WHERE connection_id = %s
                    RETURNING *
                    """,
                    (now, row["connection_id"]),
                ).fetchone()
        return _oauth_attempt_from_row(row)

    def update_oauth_attempt(
        self,
        connection_id: UUID,
        status: OAuthConnectionStatus,
        error_detail: str | None = None,
    ) -> OAuthConnectionAttemptRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_provider_oauth_attempts
                SET status = %s, error_detail = %s, updated_at = %s
                WHERE connection_id = %s
                RETURNING *
                """,
                (status, error_detail, utc_now(), connection_id),
            ).fetchone()
        return _oauth_attempt_from_row(row)

    def upsert_account(
        self,
        *,
        scope: ScopedIdentity,
        provider: ProviderKind,
        provider_subject: str,
        email: str,
        display_name: str,
        granted_scopes: list[str],
        scope_tier: OAuthScopeTier,
        refresh_token_secret_ref: str,
        token_expires_at=None,
    ) -> ProviderAccountRecord:
        provider = ProviderKind(provider)
        mail_enabled = _has_mail_read_scope(provider, granted_scopes)
        calendar_enabled = _has_calendar_read_scope(provider, granted_scopes)
        now = utc_now()
        with _connect(self.database_url) as conn:
            inserted = conn.execute(
                """
                INSERT INTO assistant_connected_provider_accounts (
                  provider_account_id, account_id, user_id, space_id, purpose, provider,
                  provider_account_ref, provider_subject, email, display_name, status,
                  sync_state, granted_scopes, scope_tier, mail_enabled, calendar_enabled,
                  refresh_token_secret_ref, token_expires_at, correlation_id,
                  audit_correlation_id, created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, 'connected',
                  'idle', %s, %s, %s, %s, %s, %s, gen_random_uuid()::text,
                  gen_random_uuid()::text, %s, %s
                )
                ON CONFLICT (provider, provider_subject) DO UPDATE SET
                  account_id = EXCLUDED.account_id,
                  user_id = EXCLUDED.user_id,
                  space_id = EXCLUDED.space_id,
                  purpose = EXCLUDED.purpose,
                  email = EXCLUDED.email,
                  display_name = EXCLUDED.display_name,
                  status = 'connected',
                  sync_state = 'idle',
                  granted_scopes = EXCLUDED.granted_scopes,
                  scope_tier = EXCLUDED.scope_tier,
                  mail_enabled = EXCLUDED.mail_enabled,
                  calendar_enabled = EXCLUDED.calendar_enabled,
                  refresh_token_secret_ref = EXCLUDED.refresh_token_secret_ref,
                  token_expires_at = EXCLUDED.token_expires_at,
                  last_sync_error = NULL,
                  last_sync_status = 'healthy',
                  last_sync_error_class = NULL,
                  retry_after = NULL,
                  stale_since = NULL,
                  last_status_detail = NULL,
                  updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    scope.account_id,
                    scope.user_id,
                    scope.space_id,
                    scope.purpose,
                    provider,
                    f"onebrain://provider-account/{provider}/{provider_subject}",
                    provider_subject,
                    email,
                    display_name,
                    _json(granted_scopes),
                    scope_tier,
                    mail_enabled,
                    calendar_enabled,
                    refresh_token_secret_ref,
                    token_expires_at,
                    now,
                    now,
                ),
            ).fetchone()
        return _provider_account_from_row(inserted)

    def get_account(self, provider_account_id: UUID) -> ProviderAccountRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                SELECT *
                FROM assistant_connected_provider_accounts
                WHERE provider_account_id = %s
                """,
                (provider_account_id,),
            ).fetchone()
        return _provider_account_from_row(row) if row else None

    def update_account_token(
        self,
        provider_account_id: UUID,
        *,
        refresh_token_secret_ref: str,
        token_expires_at=None,
    ) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET refresh_token_secret_ref = %s,
                    token_expires_at = %s,
                    updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (
                    refresh_token_secret_ref,
                    token_expires_at,
                    utc_now(),
                    provider_account_id,
                ),
            ).fetchone()
        if row is None:
            raise KeyError(provider_account_id)
        return _provider_account_from_row(row)

    def list_accounts(self) -> list[ProviderAccountRecord]:
        with _connect(self.database_url) as conn:
            rows = conn.execute(
                "SELECT * FROM assistant_connected_provider_accounts ORDER BY created_at"
            ).fetchall()
        return [_provider_account_from_row(row) for row in rows]

    def update_account_sync_status(
        self,
        provider_account_id: UUID,
        *,
        last_sync_status: ProviderOperationalSyncStatus,
        last_status_detail: str | None = None,
        last_sync_error_class: ProviderFailureClass | None = None,
        retry_after=None,
        stale_since=None,
    ) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET last_sync_status = %s,
                    last_status_detail = %s,
                    last_sync_error_class = %s,
                    retry_after = %s,
                    stale_since = %s,
                    updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (
                    ProviderOperationalSyncStatus(last_sync_status),
                    last_status_detail,
                    ProviderFailureClass(last_sync_error_class)
                    if last_sync_error_class is not None
                    else None,
                    retry_after,
                    stale_since,
                    utc_now(),
                    provider_account_id,
                ),
            ).fetchone()
        if row is None:
            raise KeyError(provider_account_id)
        return _provider_account_from_row(row)

    def disconnect_account(self, provider_account_id: UUID) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET status = 'disconnected',
                    sync_state = 'idle',
                    last_sync_status = 'paused',
                    last_status_detail = 'Provider account disconnected; sync is paused.',
                    updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (utc_now(), provider_account_id),
            ).fetchone()
        if row is None:
            raise KeyError(provider_account_id)
        return _provider_account_from_row(row)

    def mark_sync_queued(self, provider_account_id: UUID) -> ProviderAccountRecord:
        return self._set_sync_state(provider_account_id, ProviderSyncState.queued)

    def mark_syncing(self, provider_account_id: UUID) -> ProviderAccountRecord:
        return self._set_sync_state(provider_account_id, ProviderSyncState.syncing)

    def mark_sync_healthy(self, provider_account_id: UUID) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET status = 'connected',
                    sync_state = 'healthy',
                    last_sync_at = %s,
                    last_sync_error = NULL,
                    last_sync_status = 'healthy',
                    last_sync_error_class = NULL,
                    retry_after = NULL,
                    stale_since = NULL,
                    last_status_detail = 'Provider read-only sync completed.',
                    updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (utc_now(), utc_now(), provider_account_id),
            ).fetchone()
        return _provider_account_from_row(row)

    def mark_sync_degraded(self, provider_account_id: UUID, reason: str) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET status = 'degraded',
                    sync_state = 'degraded',
                    last_sync_error = %s,
                    last_sync_status = 'degraded',
                    last_status_detail = %s,
                    stale_since = COALESCE(stale_since, %s),
                    updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (reason, reason, utc_now(), utc_now(), provider_account_id),
            ).fetchone()
        return _provider_account_from_row(row)

    def upsert_cursor(
        self,
        *,
        account: ProviderAccountRecord,
        cursor_kind: str,
        cursor_value: str,
    ) -> SyncCursorRecord:
        now = utc_now()
        cursor_ref = f"onebrain://sync-cursor/{account.provider_account_id}/{cursor_kind}"
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_sync_cursors (
                  cursor_id, account_id, user_id, space_id, provider, provider_account_id,
                  provider_account_ref, cursor_kind, encrypted_cursor_value, cursor_ref,
                  reconciliation_state, last_success_at, correlation_id, created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  'current', %s, %s, %s, %s
                )
                ON CONFLICT (provider, provider_account_ref, cursor_kind) DO UPDATE SET
                  provider_account_id = EXCLUDED.provider_account_id,
                  encrypted_cursor_value = EXCLUDED.encrypted_cursor_value,
                  cursor_ref = EXCLUDED.cursor_ref,
                  reconciliation_state = 'current',
                  last_success_at = EXCLUDED.last_success_at,
                  last_error = NULL,
                  updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    account.scope.account_id,
                    account.scope.user_id,
                    account.scope.space_id,
                    account.provider,
                    account.provider_account_id,
                    account.provider_account_ref,
                    cursor_kind,
                    cursor_value,
                    cursor_ref,
                    now,
                    account.correlation_id,
                    now,
                    now,
                ),
            ).fetchone()
        return _sync_cursor_from_row(row)

    def get_cursor(
        self, provider_account_id: UUID, cursor_kind: str
    ) -> SyncCursorRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                SELECT *
                FROM assistant_sync_cursors
                WHERE provider_account_id = %s AND cursor_kind = %s
                """,
                (provider_account_id, cursor_kind),
            ).fetchone()
        return _sync_cursor_from_row(row) if row else None

    def list_cursors(self, provider_account_id: UUID | None = None) -> list[SyncCursorRecord]:
        with _connect(self.database_url) as conn:
            if provider_account_id is None:
                rows = conn.execute("SELECT * FROM assistant_sync_cursors").fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM assistant_sync_cursors WHERE provider_account_id = %s",
                    (provider_account_id,),
                ).fetchall()
        return [_sync_cursor_from_row(row) for row in rows]

    def upsert_subscription(
        self,
        *,
        account: ProviderAccountRecord,
        subscription_kind: str,
        resource_ref: str,
        expires_at=None,
        renewal_job_id: UUID | None = None,
        secret_ref: str | None = None,
    ) -> ProviderSubscriptionRecord:
        subscription_ref = f"provider://subscription/{account.provider_account_id}/{subscription_kind}"
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_provider_subscriptions (
                  subscription_id, account_id, user_id, space_id, provider, provider_account_id,
                  provider_account_ref, subscription_kind, subscription_ref, resource_ref,
                  secret_ref, state, expires_at, renewal_job_id, correlation_id,
                  created_at, updated_at
                ) VALUES (
                  gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s,
                  %s, 'active', %s, %s, %s, %s, %s
                )
                ON CONFLICT (provider, provider_account_ref, subscription_ref) DO UPDATE SET
                  provider_account_id = EXCLUDED.provider_account_id,
                  subscription_kind = EXCLUDED.subscription_kind,
                  resource_ref = EXCLUDED.resource_ref,
                  secret_ref = EXCLUDED.secret_ref,
                  state = 'active',
                  expires_at = EXCLUDED.expires_at,
                  renewal_job_id = EXCLUDED.renewal_job_id,
                  updated_at = EXCLUDED.updated_at
                RETURNING *
                """,
                (
                    account.scope.account_id,
                    account.scope.user_id,
                    account.scope.space_id,
                    account.provider,
                    account.provider_account_id,
                    account.provider_account_ref,
                    subscription_kind,
                    subscription_ref,
                    resource_ref,
                    secret_ref,
                    expires_at,
                    renewal_job_id,
                    account.correlation_id,
                    utc_now(),
                    utc_now(),
                ),
            ).fetchone()
        return _provider_subscription_from_row(row)

    def list_subscriptions(
        self, provider_account_id: UUID | None = None
    ) -> list[ProviderSubscriptionRecord]:
        with _connect(self.database_url) as conn:
            if provider_account_id is None:
                rows = conn.execute("SELECT * FROM assistant_provider_subscriptions").fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT *
                    FROM assistant_provider_subscriptions
                    WHERE provider_account_id = %s
                    """,
                    (provider_account_id,),
                ).fetchall()
        return [_provider_subscription_from_row(row) for row in rows]

    def remember_webhook_event(self, provider: ProviderKind, dedupe_key: str) -> bool:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_provider_webhook_events (provider, dedupe_key)
                VALUES (%s, %s)
                ON CONFLICT (provider, dedupe_key) DO NOTHING
                RETURNING provider
                """,
                (provider, dedupe_key),
            ).fetchone()
        return row is not None

    def enqueue_sync_job(self, queue, account: ProviderAccountRecord, sync_kind: str) -> JobRecord:
        self.mark_sync_queued(account.provider_account_id)
        job = JobRecord(
            scope=account.scope,
            job_type=f"provider.sync.{sync_kind}",
            payload_ref=f"provider-account://{account.provider_account_id}",
            idempotency_key=(
                f"{account.scope.account_id}:{account.provider_account_id}:"
                f"provider.sync:{sync_kind}:{uuid4()}"
            ),
            timezone="UTC",
            run_at=utc_now(),
            correlation_id=account.correlation_id,
            audit_correlation_id=account.audit_correlation_id,
        )
        return queue.enqueue(job)

    def enqueue_subscription_job(
        self, queue, account: ProviderAccountRecord, job_kind: str = "setup"
    ) -> JobRecord:
        job = JobRecord(
            scope=account.scope,
            job_type=f"provider.subscription.{job_kind}",
            payload_ref=f"provider-account://{account.provider_account_id}",
            idempotency_key=(
                f"{account.scope.account_id}:{account.provider_account_id}:"
                f"provider.subscription:{job_kind}:{uuid4()}"
            ),
            timezone="UTC",
            run_at=utc_now(),
            correlation_id=account.correlation_id,
            audit_correlation_id=account.audit_correlation_id,
        )
        return queue.enqueue(job)

    def _set_sync_state(
        self, provider_account_id: UUID, sync_state: ProviderSyncState
    ) -> ProviderAccountRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_connected_provider_accounts
                SET sync_state = %s, updated_at = %s
                WHERE provider_account_id = %s
                RETURNING *
                """,
                (sync_state, utc_now(), provider_account_id),
            ).fetchone()
        return _provider_account_from_row(row)


class PostgresTelegramBindingStore(InMemoryTelegramBindingStore):
    """Postgres-backed Telegram binding and delivery store."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def create_pending(
        self,
        scope: ScopedIdentity,
        bot_secret_ref: str,
        binding_code_hash: str,
        expires_at,
    ) -> TelegramBindingRecord:
        record = TelegramBindingRecord(
            scope=scope,
            bot_secret_ref=bot_secret_ref,
            binding_code_hash=binding_code_hash,
            binding_code_expires_at=expires_at,
        )
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_telegram_bindings (
                  binding_id, account_id, user_id, space_id, purpose, status,
                  bot_secret_ref, binding_code_hash, binding_code_expires_at,
                  correlation_id, audit_correlation_id, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    record.binding_id,
                    scope.account_id,
                    scope.user_id,
                    scope.space_id,
                    scope.purpose,
                    record.status,
                    bot_secret_ref,
                    binding_code_hash,
                    expires_at,
                    record.correlation_id,
                    record.audit_correlation_id,
                    record.created_at,
                    record.updated_at,
                ),
            ).fetchone()
        return _binding_from_row(row)

    def get(self, binding_id: UUID) -> TelegramBindingRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_telegram_bindings WHERE binding_id = %s",
                (binding_id,),
            ).fetchone()
        return _binding_from_row(row) if row else None

    def get_by_code_hash(self, binding_code_hash: str) -> TelegramBindingRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_telegram_bindings WHERE binding_code_hash = %s",
                (binding_code_hash,),
            ).fetchone()
        return _binding_from_row(row) if row else None

    def get_by_chat_hash(self, chat_hash: str) -> TelegramBindingRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_telegram_bindings WHERE telegram_chat_id_hash = %s",
                (chat_hash,),
            ).fetchone()
        return _binding_from_row(row) if row else None

    def verify_pending(
        self,
        binding_id: UUID,
        chat_hash: str,
        user_hash: str,
        chat_secret_ref: str,
        update_id: str,
    ) -> TelegramBindingRecord:
        now = utc_now()
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_telegram_bindings
                SET status = 'verified',
                    telegram_chat_id_hash = %s,
                    telegram_user_id_hash = %s,
                    telegram_chat_secret_ref = %s,
                    verified_at = %s,
                    updated_at = %s,
                    last_update_id = %s
                WHERE binding_id = %s
                RETURNING *
                """,
                (chat_hash, user_hash, chat_secret_ref, now, now, update_id, binding_id),
            ).fetchone()
        return _binding_from_row(row)

    def mark_expired(self, binding_id: UUID) -> TelegramBindingRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_telegram_bindings
                SET status = 'expired', updated_at = %s
                WHERE binding_id = %s
                RETURNING *
                """,
                (utc_now(), binding_id),
            ).fetchone()
        return _binding_from_row(row)

    def pause(self, chat_hash: str, update_id: str) -> TelegramBindingRecord:
        return self._set_chat_status(chat_hash, TelegramBindingStatus.paused, update_id)

    def resume(self, chat_hash: str, update_id: str) -> TelegramBindingRecord:
        return self._set_chat_status(chat_hash, TelegramBindingStatus.verified, update_id)

    def _set_chat_status(
        self, chat_hash: str, status: TelegramBindingStatus, update_id: str
    ) -> TelegramBindingRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_telegram_bindings
                SET status = %s, last_update_id = %s, updated_at = %s
                WHERE telegram_chat_id_hash = %s
                RETURNING *
                """,
                (status, update_id, utc_now(), chat_hash),
            ).fetchone()
        if row is None:
            raise TelegramBindingNotFound(chat_hash)
        return _binding_from_row(row)

    def remember_update(self, update_id: str, result: TelegramWebhookResponse) -> None:
        with _connect(self.database_url) as conn:
            conn.execute(
                """
                INSERT INTO assistant_telegram_processed_updates (update_id, response)
                VALUES (%s, %s)
                ON CONFLICT (update_id) DO NOTHING
                """,
                (update_id, _json(result.model_dump(mode="json"))),
            )

    def get_processed_update(self, update_id: str) -> TelegramWebhookResponse | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT response FROM assistant_telegram_processed_updates WHERE update_id = %s",
                (update_id,),
            ).fetchone()
        if row is None:
            return None
        return TelegramWebhookResponse.model_validate(row["response"])

    def record_event(
        self,
        binding: TelegramBindingRecord,
        event_type: str,
        update_id: str,
        sanitized_summary: str,
        provider_metadata: dict[str, str] | None = None,
    ) -> TelegramProvenanceEvent:
        metadata = {
            "binding_id": str(binding.binding_id),
            "source_update_ref": f"telegram://update/{update_id}",
            "sanitized_summary": sanitized_summary,
            "provider_metadata": provider_metadata or {},
        }
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                INSERT INTO assistant_operational_audit (
                  account_id, user_id, space_id, event_type, correlation_id,
                  audit_correlation_id, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING event_id, occurred_at
                """,
                (
                    binding.scope.account_id,
                    binding.scope.user_id,
                    binding.scope.space_id,
                    event_type,
                    binding.correlation_id,
                    binding.audit_correlation_id,
                    _json(metadata),
                ),
            ).fetchone()
        return TelegramProvenanceEvent(
            event_ref=f"onebrain://telegram-event/{row['event_id']}",
            binding_id=binding.binding_id,
            event_type=event_type,
            source_update_ref=metadata["source_update_ref"],
            sanitized_summary=sanitized_summary,
            scope=binding.scope,
            provider_metadata=provider_metadata or {},
            correlation_id=binding.correlation_id,
            audit_correlation_id=binding.audit_correlation_id,
            occurred_at=row["occurred_at"],
        )

    def events(self) -> list[TelegramProvenanceEvent]:
        with _connect(self.database_url) as conn:
            rows = conn.execute(
                """
                SELECT event_id, account_id, user_id, space_id, event_type, correlation_id,
                       audit_correlation_id, metadata, occurred_at
                FROM assistant_operational_audit
                WHERE event_type LIKE 'telegram.%'
                ORDER BY occurred_at
                """
            ).fetchall()
        return [_event_from_row(row) for row in rows]

    def create_delivery(
        self,
        binding: TelegramBindingRecord,
        message: str,
        idempotency_key: str,
    ) -> TelegramDeliveryRecord:
        delivery = TelegramDeliveryRecord(
            delivery_ref=f"onebrain://telegram-delivery/{uuid4()}",
            binding_id=binding.binding_id,
            message=message,
            idempotency_key=idempotency_key,
        )
        with _connect(self.database_url) as conn:
            inserted = conn.execute(
                """
                INSERT INTO assistant_telegram_deliveries (
                  delivery_ref, binding_id, message, idempotency_key, state,
                  created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING *
                """,
                (
                    delivery.delivery_ref,
                    delivery.binding_id,
                    delivery.message,
                    delivery.idempotency_key,
                    delivery.state,
                    delivery.created_at,
                    delivery.updated_at,
                ),
            ).fetchone()
            selected = inserted or conn.execute(
                "SELECT * FROM assistant_telegram_deliveries WHERE idempotency_key = %s",
                (idempotency_key,),
            ).fetchone()
        return _delivery_from_row(selected)

    def get_delivery(self, delivery_ref: str) -> TelegramDeliveryRecord | None:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                "SELECT * FROM assistant_telegram_deliveries WHERE delivery_ref = %s",
                (delivery_ref,),
            ).fetchone()
        return _delivery_from_row(row) if row else None

    def mark_delivery_delivered(
        self, delivery_ref: str, provider_response_ref: str
    ) -> TelegramDeliveryRecord:
        with _connect(self.database_url) as conn:
            row = conn.execute(
                """
                UPDATE assistant_telegram_deliveries
                SET state = 'delivered',
                    provider_response_ref = %s,
                    updated_at = %s
                WHERE delivery_ref = %s
                RETURNING *
                """,
                (provider_response_ref, utc_now(), delivery_ref),
            ).fetchone()
        return _delivery_from_row(row)


def _create_outbox_for_action_locked(
    conn, action: ActionRecord, effect_type: str, payload_ref: str
) -> OutboxRow:
    idempotency_key = f"{action.idempotency_key}:{effect_type}"
    row = OutboxRow(
        scope=action.scope,
        action_id=action.action_id,
        effect_type=effect_type,
        payload_ref=payload_ref,
        idempotency_key=idempotency_key,
        correlation_id=action.correlation_id,
        audit_correlation_id=action.audit_correlation_id,
    )
    inserted = conn.execute(
        """
        INSERT INTO assistant_outbox (
          outbox_id, account_id, user_id, space_id, purpose, action_id, state,
          effect_type, payload_ref, idempotency_key, correlation_id,
          audit_correlation_id, next_run_at, created_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
        """,
        (
            row.outbox_id,
            action.scope.account_id,
            action.scope.user_id,
            action.scope.space_id,
            action.scope.purpose,
            action.action_id,
            row.state,
            effect_type,
            payload_ref,
            idempotency_key,
            action.correlation_id,
            action.audit_correlation_id,
            row.next_run_at,
            row.created_at,
            row.updated_at,
        ),
    ).fetchone()
    selected = inserted or conn.execute(
        "SELECT * FROM assistant_outbox WHERE idempotency_key = %s",
        (idempotency_key,),
    ).fetchone()
    return _outbox_from_row(selected)


def _action_from_row(
    row: dict[str, Any], transitions: list[TransitionRecord] | None = None
) -> ActionRecord:
    return ActionRecord(
        action_id=row["action_id"],
        scope=_scope_from_row(row),
        state=row["state"],
        action_type=row["action_type"],
        risk_tier=row["risk_tier"],
        summary=row["summary"],
        idempotency_key=row["idempotency_key"],
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        sending_account_ref=row["sending_account_ref"],
        recipient_refs=row["recipient_refs"] or [],
        source_refs=row["source_refs"] or [],
        changed_fields=row["changed_fields"] or [],
        sensitive_flags=row["sensitive_flags"] or [],
        approval_reason=row["approval_reason"],
        reversible=row["reversible"],
        external_side_effect=row["external_side_effect"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        transitions=transitions or [],
    )


def _load_transitions(conn, action_id: UUID) -> list[TransitionRecord]:
    rows = conn.execute(
        """
        SELECT from_state, to_state, actor, channel, reason, correlation_id, occurred_at
        FROM assistant_action_transitions
        WHERE action_id = %s
        ORDER BY occurred_at
        """,
        (action_id,),
    ).fetchall()
    return [_transition_from_row(row) for row in rows]


def _insert_transition(conn, action_id: UUID, transition: TransitionRecord) -> None:
    conn.execute(
        """
        INSERT INTO assistant_action_transitions (
          action_id, from_state, to_state, actor, channel, reason, correlation_id, occurred_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            action_id,
            transition.from_state,
            transition.to_state,
            transition.actor,
            transition.channel,
            transition.reason,
            transition.correlation_id,
            transition.occurred_at,
        ),
    )


def _transition_locked(
    conn,
    row: dict[str, Any],
    to_state: ActionState,
    actor: str,
    reason: str,
    channel: ApprovalChannel | None,
) -> ActionRecord:
    action_id = row["action_id"]
    current_state = ActionState(row["state"])
    if to_state == current_state:
        return _action_from_row(row, _load_transitions(conn, action_id))
    if to_state not in ALLOWED_TRANSITIONS[current_state]:
        raise InvalidActionTransition(f"{current_state} -> {to_state} is not allowed")

    now = utc_now()
    transition = TransitionRecord(
        from_state=current_state,
        to_state=to_state,
        actor=actor,
        channel=channel,
        reason=reason,
        correlation_id=row["correlation_id"],
        occurred_at=now,
    )
    updated = conn.execute(
        """
        UPDATE assistant_actions
        SET state = %s, updated_at = %s
        WHERE action_id = %s
        RETURNING *
        """,
        (to_state, now, action_id),
    ).fetchone()
    _insert_transition(conn, action_id, transition)
    return _action_from_row(updated, _load_transitions(conn, action_id))


def _transition_from_row(row: dict[str, Any]) -> TransitionRecord:
    return TransitionRecord(
        from_state=ActionState(row["from_state"]) if row["from_state"] else None,
        to_state=ActionState(row["to_state"]),
        actor=row["actor"],
        channel=ApprovalChannel(row["channel"]) if row["channel"] else None,
        reason=row["reason"],
        correlation_id=row["correlation_id"],
        occurred_at=row["occurred_at"],
    )


def _scope_from_row(row: dict[str, Any]) -> ScopedIdentity:
    return ScopedIdentity(
        account_id=row["account_id"],
        user_id=row["user_id"],
        space_id=row["space_id"],
        purpose=row["purpose"],
    )


def _outbox_from_row(row: dict[str, Any]) -> OutboxRow:
    return OutboxRow(
        outbox_id=row["outbox_id"],
        scope=_scope_from_row(row),
        action_id=row["action_id"],
        state=row["state"],
        effect_type=row["effect_type"],
        payload_ref=row["payload_ref"],
        idempotency_key=row["idempotency_key"],
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        lease_owner=row["lease_owner"],
        lease_expires_at=row["lease_expires_at"],
        retry_count=row["retry_count"],
        next_run_at=row["next_run_at"],
        last_error=row["last_error"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _job_from_row(row: dict[str, Any]) -> JobRecord:
    return JobRecord(
        job_id=row["job_id"],
        scope=_scope_from_row(row),
        state=row["state"],
        job_type=row["job_type"],
        payload_ref=row["payload_ref"],
        idempotency_key=row["idempotency_key"],
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        timezone=row["timezone"],
        run_at=row["run_at"],
        lease_owner=row["lease_owner"],
        lease_expires_at=row["lease_expires_at"],
        retry_count=row["retry_count"],
        last_error=row["last_error"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _oauth_attempt_from_row(row: dict[str, Any]) -> OAuthConnectionAttemptRecord:
    return OAuthConnectionAttemptRecord(
        connection_id=row["connection_id"],
        scope=_scope_from_row(row),
        provider=ProviderKind(row["provider"]),
        state_hash=row["state_hash"],
        requested_scope_tier=OAuthScopeTier(row["requested_scope_tier"]),
        requested_scopes=row["requested_scopes"] or [],
        requested_services=row["requested_services"] or [],
        redirect_uri=row["redirect_uri"],
        status=OAuthConnectionStatus(row["status"]),
        expires_at=row["expires_at"],
        error_detail=row["error_detail"],
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _provider_account_from_row(row: dict[str, Any]) -> ProviderAccountRecord:
    return ProviderAccountRecord(
        provider_account_id=row["provider_account_id"],
        scope=_scope_from_row(row),
        provider=ProviderKind(row["provider"]),
        provider_account_ref=row["provider_account_ref"],
        provider_subject=row["provider_subject"],
        email=row["email"] or "",
        display_name=row["display_name"] or "",
        status=ProviderAccountStatus(row["status"]),
        sync_state=ProviderSyncState(row["sync_state"]),
        granted_scopes=row["granted_scopes"] or [],
        scope_tier=OAuthScopeTier(row["scope_tier"]),
        mail_enabled=row["mail_enabled"],
        calendar_enabled=row["calendar_enabled"],
        refresh_token_secret_ref=row["refresh_token_secret_ref"],
        token_expires_at=row["token_expires_at"],
        last_sync_at=row["last_sync_at"],
        last_sync_error=row["last_sync_error"],
        last_sync_status=ProviderOperationalSyncStatus(
            row.get("last_sync_status") or ProviderOperationalSyncStatus.healthy
        ),
        last_sync_error_class=ProviderFailureClass(row["last_sync_error_class"])
        if row.get("last_sync_error_class")
        else None,
        retry_after=row.get("retry_after"),
        stale_since=row.get("stale_since"),
        last_status_detail=row.get("last_status_detail"),
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _sync_cursor_from_row(row: dict[str, Any]) -> SyncCursorRecord:
    return SyncCursorRecord(
        cursor_id=row["cursor_id"],
        scope=_scope_from_row(row),
        provider=ProviderKind(row["provider"]),
        provider_account_id=row["provider_account_id"],
        provider_account_ref=row["provider_account_ref"],
        cursor_kind=row["cursor_kind"],
        cursor_value=row["encrypted_cursor_value"] or "",
        cursor_ref=row["cursor_ref"] or "",
        reconciliation_state=row["reconciliation_state"],
        last_success_at=row["last_success_at"],
        last_error=row["last_error"],
        correlation_id=row["correlation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _provider_subscription_from_row(row: dict[str, Any]) -> ProviderSubscriptionRecord:
    return ProviderSubscriptionRecord(
        subscription_id=row["subscription_id"],
        scope=_scope_from_row(row),
        provider=ProviderKind(row["provider"]),
        provider_account_id=row["provider_account_id"],
        provider_account_ref=row["provider_account_ref"],
        subscription_kind=row["subscription_kind"],
        subscription_ref=row["subscription_ref"],
        resource_ref=row["resource_ref"],
        state=row["state"],
        expires_at=row["expires_at"],
        renewal_job_id=row["renewal_job_id"],
        secret_ref=row["secret_ref"],
        correlation_id=row["correlation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _has_mail_read_scope(provider: ProviderKind, granted_scopes: list[str]) -> bool:
    if ProviderKind(provider) == ProviderKind.google:
        needed = [
            scope for scope in scopes_for(provider, OAuthScopeTier.read_only) if "gmail" in scope
        ]
    elif ProviderKind(provider) == ProviderKind.microsoft:
        needed = ["Mail.Read"]
    return all(scope in set(granted_scopes) for scope in needed)


def _has_calendar_read_scope(provider: ProviderKind, granted_scopes: list[str]) -> bool:
    if ProviderKind(provider) == ProviderKind.google:
        needed = [
            scope for scope in scopes_for(provider, OAuthScopeTier.read_only) if "calendar" in scope
        ]
    else:
        needed = ["Calendars.Read"]
    return all(scope in set(granted_scopes) for scope in needed)


def _binding_from_row(row: dict[str, Any]) -> TelegramBindingRecord:
    return TelegramBindingRecord(
        binding_id=row["binding_id"],
        scope=_scope_from_row(row),
        status=row["status"],
        bot_secret_ref=row["bot_secret_ref"],
        binding_code_hash=row["binding_code_hash"],
        binding_code_expires_at=row["binding_code_expires_at"],
        telegram_chat_id_hash=row["telegram_chat_id_hash"],
        telegram_user_id_hash=row["telegram_user_id_hash"],
        telegram_chat_secret_ref=row["telegram_chat_secret_ref"],
        verified_at=row["verified_at"],
        revoked_at=row["revoked_at"],
        last_update_id=row["last_update_id"],
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _delivery_from_row(row: dict[str, Any]) -> TelegramDeliveryRecord:
    return TelegramDeliveryRecord(
        delivery_ref=row["delivery_ref"],
        binding_id=row["binding_id"],
        message=row["message"],
        idempotency_key=row["idempotency_key"],
        state=row["state"],
        provider_response_ref=row["provider_response_ref"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _event_from_row(row: dict[str, Any]) -> TelegramProvenanceEvent:
    metadata = row["metadata"]
    binding_id = metadata.get("binding_id")
    return TelegramProvenanceEvent(
        event_ref=f"onebrain://telegram-event/{row['event_id']}",
        binding_id=UUID(binding_id),
        event_type=row["event_type"],
        source_update_ref=metadata.get("source_update_ref", "telegram://update/unknown"),
        sanitized_summary=metadata.get("sanitized_summary", "Telegram event recorded."),
        scope=ScopedIdentity(
            account_id=row["account_id"],
            user_id=row["user_id"],
            space_id=row["space_id"],
        ),
        provider_metadata=metadata.get("provider_metadata", {}),
        correlation_id=row["correlation_id"],
        audit_correlation_id=row["audit_correlation_id"],
        occurred_at=row["occurred_at"],
    )
