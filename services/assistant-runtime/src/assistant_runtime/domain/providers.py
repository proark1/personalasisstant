from __future__ import annotations

from datetime import timedelta
from threading import RLock
from uuid import UUID, uuid4

from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.providers.oauth import missing_read_scopes, scopes_for
from assistant_runtime.schemas import (
    JobRecord,
    OAuthConnectionAttemptRecord,
    OAuthConnectionStatus,
    OAuthScopeTier,
    ProviderAccountRecord,
    ProviderAccountStatus,
    ProviderAccountSummary,
    ProviderCapabilityStatus,
    ProviderFailureClass,
    ProviderKind,
    ProviderOperationalSyncStatus,
    ProviderService,
    ProviderSubscriptionRecord,
    ProviderSyncState,
    ScopedIdentity,
    SyncCursorRecord,
    utc_now,
)


class ProviderAccountNotFound(KeyError):
    pass


class OAuthAttemptNotFound(KeyError):
    pass


class InMemoryProviderStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._attempts: dict[UUID, OAuthConnectionAttemptRecord] = {}
        self._attempt_state_index: dict[str, UUID] = {}
        self._accounts: dict[UUID, ProviderAccountRecord] = {}
        self._account_identity_index: dict[tuple[ProviderKind, str], UUID] = {}
        self._cursors: dict[tuple[UUID, str], SyncCursorRecord] = {}
        self._subscriptions: dict[tuple[UUID, str], ProviderSubscriptionRecord] = {}
        self._webhook_events: dict[str, str] = {}

    def create_oauth_attempt(
        self, attempt: OAuthConnectionAttemptRecord
    ) -> OAuthConnectionAttemptRecord:
        with self._lock:
            self._attempts[attempt.connection_id] = attempt
            self._attempt_state_index[attempt.state_hash] = attempt.connection_id
            return attempt

    def get_oauth_attempt_by_state(
        self, state_hash: str, now=None
    ) -> OAuthConnectionAttemptRecord | None:
        now = now or utc_now()
        with self._lock:
            attempt_id = self._attempt_state_index.get(state_hash)
            if attempt_id is None:
                return None
            attempt = self._attempts[attempt_id]
            if (
                OAuthConnectionStatus(attempt.status) == OAuthConnectionStatus.pending
                and attempt.expires_at <= now
            ):
                attempt.status = OAuthConnectionStatus.expired
                attempt.updated_at = now
            return attempt

    def update_oauth_attempt(
        self,
        connection_id: UUID,
        status: OAuthConnectionStatus,
        error_detail: str | None = None,
    ) -> OAuthConnectionAttemptRecord:
        with self._lock:
            attempt = self._attempts[connection_id]
            attempt.status = status
            attempt.error_detail = error_detail
            attempt.updated_at = utc_now()
            return attempt

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
        key = (provider, provider_subject)
        with self._lock:
            existing_id = self._account_identity_index.get(key)
            if existing_id is not None:
                account = self._accounts[existing_id]
                account.scope = scope
                account.email = email
                account.display_name = display_name
                account.status = ProviderAccountStatus.connected
                account.sync_state = ProviderSyncState.idle
                account.granted_scopes = granted_scopes
                account.scope_tier = scope_tier
                account.mail_enabled = _service_enabled(
                    provider, granted_scopes, ProviderService.mail
                )
                account.calendar_enabled = _service_enabled(
                    provider, granted_scopes, ProviderService.calendar
                )
                account.refresh_token_secret_ref = refresh_token_secret_ref
                account.token_expires_at = token_expires_at
                account.last_sync_error = None
                account.last_sync_status = ProviderOperationalSyncStatus.healthy
                account.last_sync_error_class = None
                account.retry_after = None
                account.stale_since = None
                account.last_status_detail = None
                account.updated_at = utc_now()
                return account

            account = ProviderAccountRecord(
                scope=scope,
                provider=provider,
                provider_account_ref=f"onebrain://provider-account/{provider}/{provider_subject}",
                provider_subject=provider_subject,
                email=email,
                display_name=display_name,
                granted_scopes=granted_scopes,
                scope_tier=scope_tier,
                mail_enabled=_service_enabled(provider, granted_scopes, ProviderService.mail),
                calendar_enabled=_service_enabled(
                    provider, granted_scopes, ProviderService.calendar
                ),
                refresh_token_secret_ref=refresh_token_secret_ref,
                token_expires_at=token_expires_at,
            )
            self._accounts[account.provider_account_id] = account
            self._account_identity_index[key] = account.provider_account_id
            return account

    def get_account(self, provider_account_id: UUID) -> ProviderAccountRecord | None:
        with self._lock:
            return self._accounts.get(provider_account_id)

    def update_account_token(
        self,
        provider_account_id: UUID,
        *,
        refresh_token_secret_ref: str,
        token_expires_at=None,
    ) -> ProviderAccountRecord:
        with self._lock:
            account = self._require_account(provider_account_id)
            account.refresh_token_secret_ref = refresh_token_secret_ref
            account.token_expires_at = token_expires_at
            account.updated_at = utc_now()
            return account

    def list_accounts(self) -> list[ProviderAccountRecord]:
        with self._lock:
            return sorted(self._accounts.values(), key=lambda account: account.created_at)

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
        with self._lock:
            account = self._require_account(provider_account_id)
            account.last_sync_status = ProviderOperationalSyncStatus(last_sync_status)
            account.last_status_detail = last_status_detail
            account.last_sync_error_class = (
                ProviderFailureClass(last_sync_error_class)
                if last_sync_error_class is not None
                else None
            )
            account.retry_after = retry_after
            account.stale_since = stale_since
            account.updated_at = utc_now()
            return account

    def disconnect_account(self, provider_account_id: UUID) -> ProviderAccountRecord:
        with self._lock:
            account = self._accounts.get(provider_account_id)
            if account is None:
                raise ProviderAccountNotFound(str(provider_account_id))
            account.status = ProviderAccountStatus.disconnected
            account.sync_state = ProviderSyncState.idle
            account.last_sync_status = ProviderOperationalSyncStatus.paused
            account.last_status_detail = "Provider account disconnected; sync is paused."
            account.updated_at = utc_now()
            return account

    def mark_sync_queued(self, provider_account_id: UUID) -> ProviderAccountRecord:
        return self._set_sync_state(provider_account_id, ProviderSyncState.queued)

    def mark_syncing(self, provider_account_id: UUID) -> ProviderAccountRecord:
        return self._set_sync_state(provider_account_id, ProviderSyncState.syncing)

    def mark_sync_healthy(self, provider_account_id: UUID) -> ProviderAccountRecord:
        with self._lock:
            account = self._require_account(provider_account_id)
            account.status = ProviderAccountStatus.connected
            account.sync_state = ProviderSyncState.healthy
            account.last_sync_at = utc_now()
            account.last_sync_error = None
            account.last_sync_status = ProviderOperationalSyncStatus.healthy
            account.last_sync_error_class = None
            account.retry_after = None
            account.stale_since = None
            account.last_status_detail = "Provider read-only sync completed."
            account.updated_at = account.last_sync_at
            return account

    def mark_sync_degraded(self, provider_account_id: UUID, reason: str) -> ProviderAccountRecord:
        with self._lock:
            account = self._require_account(provider_account_id)
            account.status = ProviderAccountStatus.degraded
            account.sync_state = ProviderSyncState.degraded
            account.last_sync_error = reason
            account.last_sync_status = ProviderOperationalSyncStatus.degraded
            account.last_status_detail = reason
            account.stale_since = account.stale_since or utc_now()
            account.updated_at = utc_now()
            return account

    def upsert_cursor(
        self,
        *,
        account: ProviderAccountRecord,
        cursor_kind: str,
        cursor_value: str,
    ) -> SyncCursorRecord:
        key = (account.provider_account_id, cursor_kind)
        with self._lock:
            existing = self._cursors.get(key)
            if existing is not None:
                existing.cursor_value = cursor_value
                existing.cursor_ref = _cursor_ref(account, cursor_kind)
                existing.reconciliation_state = "current"
                existing.last_success_at = utc_now()
                existing.last_error = None
                existing.updated_at = existing.last_success_at
                return existing
            cursor = SyncCursorRecord(
                scope=account.scope,
                provider=account.provider,
                provider_account_id=account.provider_account_id,
                provider_account_ref=account.provider_account_ref,
                cursor_kind=cursor_kind,
                cursor_value=cursor_value,
                cursor_ref=_cursor_ref(account, cursor_kind),
                last_success_at=utc_now(),
            )
            self._cursors[key] = cursor
            return cursor

    def get_cursor(
        self, provider_account_id: UUID, cursor_kind: str
    ) -> SyncCursorRecord | None:
        with self._lock:
            return self._cursors.get((provider_account_id, cursor_kind))

    def list_cursors(self, provider_account_id: UUID | None = None) -> list[SyncCursorRecord]:
        with self._lock:
            cursors = list(self._cursors.values())
        if provider_account_id is None:
            return cursors
        return [cursor for cursor in cursors if cursor.provider_account_id == provider_account_id]

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
        key = (account.provider_account_id, subscription_kind)
        with self._lock:
            existing = self._subscriptions.get(key)
            if existing is not None:
                existing.state = "active"
                existing.resource_ref = resource_ref
                existing.expires_at = expires_at
                existing.renewal_job_id = renewal_job_id
                existing.secret_ref = secret_ref
                existing.updated_at = utc_now()
                return existing
            subscription = ProviderSubscriptionRecord(
                scope=account.scope,
                provider=account.provider,
                provider_account_id=account.provider_account_id,
                provider_account_ref=account.provider_account_ref,
                subscription_kind=subscription_kind,
                subscription_ref=f"provider://subscription/{account.provider_account_id}/{subscription_kind}",
                resource_ref=resource_ref,
                expires_at=expires_at,
                renewal_job_id=renewal_job_id,
                secret_ref=secret_ref,
            )
            self._subscriptions[key] = subscription
            return subscription

    def list_subscriptions(
        self, provider_account_id: UUID | None = None
    ) -> list[ProviderSubscriptionRecord]:
        with self._lock:
            subscriptions = list(self._subscriptions.values())
        if provider_account_id is None:
            return subscriptions
        return [
            subscription
            for subscription in subscriptions
            if subscription.provider_account_id == provider_account_id
        ]

    def remember_webhook_event(self, provider: ProviderKind, dedupe_key: str) -> bool:
        key = f"{ProviderKind(provider)}:{dedupe_key}"
        with self._lock:
            if key in self._webhook_events:
                return False
            self._webhook_events[key] = utc_now().isoformat()
            return True

    def enqueue_sync_job(
        self,
        queue: InMemoryQueueProvider,
        account: ProviderAccountRecord,
        sync_kind: str,
    ) -> JobRecord:
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
        self,
        queue: InMemoryQueueProvider,
        account: ProviderAccountRecord,
        job_kind: str = "setup",
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
        with self._lock:
            account = self._require_account(provider_account_id)
            account.sync_state = sync_state
            account.updated_at = utc_now()
            return account

    def _require_account(self, provider_account_id: UUID) -> ProviderAccountRecord:
        account = self._accounts.get(provider_account_id)
        if account is None:
            raise ProviderAccountNotFound(str(provider_account_id))
        return account


def summarize_provider_account(account: ProviderAccountRecord) -> ProviderAccountSummary:
    missing = missing_read_scopes(account.provider, account.granted_scopes)
    return ProviderAccountSummary(
        provider_account_id=account.provider_account_id,
        provider=account.provider,
        provider_account_ref=account.provider_account_ref,
        email=account.email,
        display_name=account.display_name,
        status=account.status,
        sync_state=account.sync_state,
        granted_scopes=list(account.granted_scopes),
        missing_scopes=missing,
        scope_tier=account.scope_tier,
        capabilities=_capabilities(account),
        mail_enabled=account.mail_enabled,
        calendar_enabled=account.calendar_enabled,
        last_sync_at=account.last_sync_at,
        last_sync_error=account.last_sync_error,
        last_sync_status=account.last_sync_status,
        last_sync_error_class=account.last_sync_error_class,
        retry_after=account.retry_after,
        stale_since=account.stale_since,
        last_status_detail=account.last_status_detail,
    )


def provider_account_id_from_payload_ref(payload_ref: str) -> UUID:
    prefix = "provider-account://"
    if not payload_ref.startswith(prefix):
        raise ValueError("Provider job payload_ref must use provider-account://.")
    return UUID(payload_ref.removeprefix(prefix))


def subscription_expiry(provider: ProviderKind):
    now = utc_now()
    if ProviderKind(provider) == ProviderKind.google:
        return now + timedelta(days=6)
    return now + timedelta(days=2)


def _service_enabled(
    provider: ProviderKind,
    granted_scopes: list[str],
    service: ProviderService,
) -> bool:
    needed = scopes_for(provider, OAuthScopeTier.read_only, [service])
    return all(scope in set(granted_scopes) for scope in needed)


def _capabilities(account: ProviderAccountRecord) -> list[ProviderCapabilityStatus]:
    return [
        ProviderCapabilityStatus(
            key="mail_read",
            label="Read mail",
            service=ProviderService.mail,
            granted=account.mail_enabled,
            required_scopes=scopes_for(
                account.provider, OAuthScopeTier.read_only, [ProviderService.mail]
            ),
        ),
        ProviderCapabilityStatus(
            key="calendar_read",
            label="Read calendar",
            service=ProviderService.calendar,
            granted=account.calendar_enabled,
            required_scopes=scopes_for(
                account.provider, OAuthScopeTier.read_only, [ProviderService.calendar]
            ),
        ),
        ProviderCapabilityStatus(
            key="mail_draft",
            label="Create drafts later",
            service=ProviderService.mail,
            granted=False,
            required_scopes=scopes_for(account.provider, OAuthScopeTier.draft_write),
            upgrade_tier=OAuthScopeTier.draft_write,
        ),
        ProviderCapabilityStatus(
            key="mail_send",
            label="Send after approval later",
            service=ProviderService.mail,
            granted=False,
            required_scopes=scopes_for(account.provider, OAuthScopeTier.send),
            upgrade_tier=OAuthScopeTier.send,
        ),
        ProviderCapabilityStatus(
            key="calendar_write",
            label="Write calendar after approval later",
            service=ProviderService.calendar,
            granted=False,
            required_scopes=scopes_for(account.provider, OAuthScopeTier.calendar_write),
            upgrade_tier=OAuthScopeTier.calendar_write,
        ),
    ]


def _cursor_ref(account: ProviderAccountRecord, cursor_kind: str) -> str:
    return f"onebrain://sync-cursor/{account.provider_account_id}/{cursor_kind}"
