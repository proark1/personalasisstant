from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from assistant_runtime.domain.providers import (
    InMemoryProviderStore,
    provider_account_id_from_payload_ref,
    subscription_expiry,
)
from assistant_runtime.interfaces import BrainClient, SecretProvider
from assistant_runtime.providers.onebrain_events import (
    record_provider_calendar_event_source,
    record_provider_health_event,
    record_provider_message_source,
    record_sync_cursor_event,
    record_sync_subscription_event,
)
from assistant_runtime.providers.read_adapters import (
    ProviderCursorContext,
    ProviderFetchResult,
    ProviderReadClient,
    ProviderReadError,
    local_provider_fetch_result,
)
from assistant_runtime.providers.reliability import sync_status_for_failure
from assistant_runtime.providers.token_refresh import (
    ProviderTokenRefresher,
    ProviderTokenRefreshError,
)
from assistant_runtime.schemas import (
    JobRecord,
    ProviderAccountRecord,
    ProviderFailureClass,
    ProviderKind,
    ProviderOperationalSyncStatus,
    utc_now,
)


@dataclass(frozen=True)
class SyncSubscription:
    provider: str
    provider_account_ref: str
    subscription_ref: str
    cursor_ref: str | None
    renewal_job_ref: str


@dataclass(frozen=True)
class SyncFailure:
    detail: str
    failure_class: ProviderFailureClass | None = None
    retry_after: datetime | None = None
    retryable: bool = False


class SyncProviderSkeleton:
    async def renew_subscription(self, provider_account_ref: str) -> str:
        return f"onebrain://sync-renewal/{provider_account_ref}"

    async def reconcile(self, provider_account_ref: str, cursor_ref: str | None) -> str:
        suffix = cursor_ref or "full"
        return f"onebrain://sync-reconciliation/{provider_account_ref}/{suffix}"


class ProviderSyncProcessor:
    def __init__(
        self,
        providers: InMemoryProviderStore,
        brain: BrainClient | None = None,
        secrets: SecretProvider | None = None,
        reader: ProviderReadClient | None = None,
        token_refresher: ProviderTokenRefresher | None = None,
    ) -> None:
        self.providers = providers
        self.brain = brain
        self.secrets = secrets
        self.reader = reader
        self.token_refresher = token_refresher

    def can_process(self, job: JobRecord) -> bool:
        return job.job_type.startswith("provider.sync.") or job.job_type.startswith(
            "provider.subscription."
        )

    def process(self, job: JobRecord) -> None:
        account_id = provider_account_id_from_payload_ref(job.payload_ref)
        account = self.providers.get_account(account_id)
        if account is None:
            raise ValueError("Provider account not found for sync job.")
        if not self._brain_available():
            degraded = self.providers.mark_sync_degraded(
                account.provider_account_id,
                "OneBrain provenance is unavailable; provider sync is paused.",
            )
            degraded = self.providers.update_account_sync_status(
                degraded.provider_account_id,
                last_sync_status=ProviderOperationalSyncStatus.paused,
                last_status_detail="OneBrain provenance is unavailable; provider sync is paused.",
            )
            self._safe_record_health(
                degraded,
                "OneBrain provenance is unavailable; provider sync is paused.",
            )
            raise RuntimeError("OneBrainUnavailable")

        if job.job_type.startswith("provider.subscription."):
            subscriptions = self._setup_subscriptions(account, job)
            for subscription in subscriptions:
                self._safe_record_subscription(subscription)
            return

        if self._retry_after_pending(account):
            detail = (
                "Provider sync is waiting for retry-after until "
                f"{account.retry_after.isoformat()}."
            )
            waiting = self.providers.update_account_sync_status(
                account.provider_account_id,
                last_sync_status=account.last_sync_status,
                last_status_detail=detail,
                last_sync_error_class=account.last_sync_error_class,
                retry_after=account.retry_after,
                stale_since=account.stale_since,
            )
            self._safe_record_health(waiting, detail)
            return

        self.providers.mark_syncing(account.provider_account_id)
        source_count, source_error, cursor_updates, sync_failure = self._record_workday_sources(
            account
        )
        if cursor_updates:
            cursors = self._upsert_cursor_updates(account, cursor_updates)
        elif source_error:
            cursors = []
        else:
            cursors = self._advance_cursors(account)
        for cursor in cursors:
            self._safe_record_cursor(cursor)
        if source_error:
            degraded = self._mark_sync_degraded(account, source_error, sync_failure)
            self._safe_record_health(degraded, source_error)
            return
        healthy = self.providers.mark_sync_healthy(account.provider_account_id)
        self._safe_record_health(
            healthy,
            f"Provider read-only sync completed with {source_count} workday source records.",
        )

    def _advance_cursors(self, account: ProviderAccountRecord):
        now_value = datetime.now(UTC).replace(microsecond=0).isoformat()
        cursor_kinds = _cursor_kinds(account)
        return [
            self.providers.upsert_cursor(
                account=account,
                cursor_kind=cursor_kind,
                cursor_value=f"{cursor_kind}:{now_value}",
            )
            for cursor_kind in cursor_kinds
        ]

    def _upsert_cursor_updates(
        self,
        account: ProviderAccountRecord,
        cursor_updates: dict[str, str],
    ):
        return [
            self.providers.upsert_cursor(
                account=account,
                cursor_kind=cursor_kind,
                cursor_value=cursor_value,
            )
            for cursor_kind, cursor_value in cursor_updates.items()
            if cursor_value
        ]

    def _setup_subscriptions(self, account: ProviderAccountRecord, job: JobRecord):
        subscriptions = []
        for kind, resource in _subscription_resources(account):
            subscriptions.append(
                self.providers.upsert_subscription(
                    account=account,
                    subscription_kind=kind,
                    resource_ref=resource,
                    expires_at=subscription_expiry(account.provider),
                    renewal_job_id=job.job_id,
                )
            )
        return subscriptions

    def _safe_record_cursor(self, cursor) -> None:
        if self.brain is None:
            return
        try:
            asyncio.run(record_sync_cursor_event(self.brain, cursor))
        except Exception:
            return

    def _safe_record_subscription(self, subscription) -> None:
        if self.brain is None:
            return
        try:
            asyncio.run(record_sync_subscription_event(self.brain, subscription))
        except Exception:
            return

    def _safe_record_health(self, account: ProviderAccountRecord, detail: str) -> None:
        if self.brain is None:
            return
        try:
            asyncio.run(record_provider_health_event(self.brain, account, detail))
        except Exception:
            return

    def _record_workday_sources(
        self,
        account: ProviderAccountRecord,
    ) -> tuple[int, str | None, dict[str, str], SyncFailure | None]:
        if self.brain is None:
            return 0, None, {}, None
        local_date = datetime.now(UTC).date().isoformat()
        try:
            fetch_result, source_error, sync_failure = self._fetch_provider_sources(
                account,
                local_date,
            )
            count = 0
            for message in fetch_result.messages:
                asyncio.run(
                    record_provider_message_source(
                        self.brain,
                        account,
                        **message.to_record_kwargs(),
                    )
                )
                count += 1
            for event in fetch_result.calendar_events:
                asyncio.run(
                    record_provider_calendar_event_source(
                        self.brain,
                        account,
                        **event.to_record_kwargs(),
                    )
                )
                count += 1
            return count, source_error, dict(fetch_result.cursor_updates), sync_failure
        except Exception:
            return (
                0,
                "Provider source normalization failed; workday source records are stale.",
                {},
                SyncFailure(
                    "Provider source normalization failed; workday source records are stale.",
                    failure_class=ProviderFailureClass.permanent,
                ),
            )

    def _fetch_provider_sources(
        self,
        account: ProviderAccountRecord,
        local_date: str,
    ) -> tuple[ProviderFetchResult, str | None, SyncFailure | None]:
        if self.reader is None or self.secrets is None:
            return (
                local_provider_fetch_result(account, local_date, reason="local_sync_adapter"),
                None,
                None,
            )
        try:
            if self.token_refresher is not None:
                refresh_result = asyncio.run(self.token_refresher.token_for_read(account))
                read_account = refresh_result.account
                token_payload = refresh_result.token_payload
            else:
                read_account = account
                raw_token_payload = self.secrets.retrieve_secret(account.refresh_token_secret_ref)
                token_payload = json.loads(raw_token_payload)
                if not isinstance(token_payload, dict):
                    raise ValueError("Provider token payload must be an object.")
        except ProviderTokenRefreshError as exc:
            detail = f"Provider token refresh failed; {exc.detail}"
            return (
                local_provider_fetch_result(account, local_date, reason="token_refresh_failed"),
                detail,
                SyncFailure(
                    detail,
                    failure_class=exc.failure_class,
                    retry_after=exc.retry_after,
                    retryable=exc.retryable,
                ),
            )
        except Exception:
            detail = (
                "Provider token secret is unavailable; workday source records used local "
                "fallback."
            )
            return (
                local_provider_fetch_result(account, local_date, reason="token_unavailable"),
                detail,
                SyncFailure(
                    detail,
                    failure_class=ProviderFailureClass.auth,
                ),
            )
        cursor_context = ProviderCursorContext(
            {
                cursor.cursor_kind: cursor.cursor_value
                for cursor in self.providers.list_cursors(account.provider_account_id)
            }
        )
        try:
            fetch_result = asyncio.run(
                self.reader.fetch_sources(
                    read_account,
                    token_payload,
                    local_date=local_date,
                    cursors=cursor_context,
                )
            )
            source_error = _source_error_from_fetch_result(fetch_result)
            sync_failure = _failure_from_fetch_result(fetch_result, source_error)
            return fetch_result, source_error, sync_failure
        except ProviderReadError as exc:
            detail = f"Provider live read failed; {exc.detail}"
            return (
                local_provider_fetch_result(account, local_date, reason="live_read_failed"),
                detail,
                SyncFailure(
                    detail,
                    failure_class=exc.failure_class,
                    retry_after=exc.retry_after,
                    retryable=exc.retryable,
                ),
            )
        except Exception as exc:
            detail = f"Provider live read failed; {exc.__class__.__name__}."
            return (
                local_provider_fetch_result(account, local_date, reason="live_read_failed"),
                detail,
                SyncFailure(
                    detail,
                    failure_class=ProviderFailureClass.transient,
                    retryable=True,
                ),
            )

    def _brain_available(self) -> bool:
        if self.brain is None:
            return True
        try:
            return asyncio.run(self.brain.check_available())
        except Exception:
            return False

    def _retry_after_pending(self, account: ProviderAccountRecord) -> bool:
        return account.retry_after is not None and account.retry_after > utc_now()

    def _mark_sync_degraded(
        self,
        account: ProviderAccountRecord,
        detail: str,
        sync_failure: SyncFailure | None,
    ) -> ProviderAccountRecord:
        degraded = self.providers.mark_sync_degraded(account.provider_account_id, detail)
        if sync_failure is None or sync_failure.failure_class is None:
            return degraded
        retry_after = sync_failure.retry_after
        if retry_after is None and sync_failure.retryable:
            retry_after = utc_now() + timedelta(minutes=5)
        return self.providers.update_account_sync_status(
            degraded.provider_account_id,
            last_sync_status=sync_status_for_failure(sync_failure.failure_class),
            last_status_detail=detail,
            last_sync_error_class=sync_failure.failure_class,
            retry_after=retry_after,
            stale_since=degraded.stale_since or utc_now(),
        )


def _cursor_kinds(account: ProviderAccountRecord) -> list[str]:
    provider = ProviderKind(account.provider)
    kinds: list[str] = []
    if provider == ProviderKind.google:
        if account.mail_enabled:
            kinds.append("gmail_history")
        if account.calendar_enabled:
            kinds.append("google_calendar_sync_token")
        return kinds
    if account.mail_enabled:
        kinds.append("microsoft_mail_delta_link")
    if account.calendar_enabled:
        kinds.append("microsoft_calendar_delta_link")
    return kinds


def _source_error_from_fetch_result(fetch_result: ProviderFetchResult) -> str | None:
    if fetch_result.live and fetch_result.fallback_reason:
        return f"Provider live read degraded; {fetch_result.fallback_reason}"
    return None


def _failure_from_fetch_result(
    fetch_result: ProviderFetchResult,
    source_error: str | None,
) -> SyncFailure | None:
    if source_error is None:
        return None
    return SyncFailure(
        source_error,
        failure_class=fetch_result.failure_class or ProviderFailureClass.permanent,
        retry_after=fetch_result.retry_after,
        retryable=False,
    )


def _subscription_resources(account: ProviderAccountRecord) -> list[tuple[str, str]]:
    provider = ProviderKind(account.provider)
    resources: list[tuple[str, str]] = []
    if provider == ProviderKind.google:
        if account.mail_enabled:
            resources.append(("gmail_watch", "gmail://users/me/watch"))
        if account.calendar_enabled:
            resources.append(("google_calendar_watch", "calendar://primary/events/watch"))
        return resources
    if account.mail_enabled:
        resources.append(("microsoft_mail_change_notification", "graph://me/messages"))
    if account.calendar_enabled:
        resources.append(("microsoft_calendar_change_notification", "graph://me/events"))
    return resources


