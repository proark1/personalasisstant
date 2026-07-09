from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import UTC, datetime

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
    ProviderFetchResult,
    ProviderReadClient,
    ProviderReadError,
    local_provider_fetch_result,
)
from assistant_runtime.schemas import JobRecord, ProviderAccountRecord, ProviderKind


@dataclass(frozen=True)
class SyncSubscription:
    provider: str
    provider_account_ref: str
    subscription_ref: str
    cursor_ref: str | None
    renewal_job_ref: str


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
    ) -> None:
        self.providers = providers
        self.brain = brain
        self.secrets = secrets
        self.reader = reader

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
            self.providers.mark_sync_degraded(
                account.provider_account_id,
                "OneBrain provenance is unavailable; provider sync is paused.",
            )
            raise RuntimeError("OneBrainUnavailable")

        if job.job_type.startswith("provider.subscription."):
            subscriptions = self._setup_subscriptions(account, job)
            for subscription in subscriptions:
                self._safe_record_subscription(subscription)
            return

        self.providers.mark_syncing(account.provider_account_id)
        source_count, source_error = self._record_workday_sources(account)
        if source_error:
            degraded = self.providers.mark_sync_degraded(
                account.provider_account_id,
                source_error,
            )
            self._safe_record_health(degraded, source_error)
            return
        cursors = self._advance_cursors(account)
        for cursor in cursors:
            self._safe_record_cursor(cursor)
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

    def _record_workday_sources(self, account: ProviderAccountRecord) -> tuple[int, str | None]:
        if self.brain is None:
            return 0, None
        local_date = datetime.now(UTC).date().isoformat()
        try:
            fetch_result, source_error = self._fetch_provider_sources(account, local_date)
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
            return count, source_error
        except Exception:
            return 0, "Provider source normalization failed; workday source records are stale."

    def _fetch_provider_sources(
        self,
        account: ProviderAccountRecord,
        local_date: str,
    ) -> tuple[ProviderFetchResult, str | None]:
        if self.reader is None or self.secrets is None:
            return (
                local_provider_fetch_result(account, local_date, reason="local_sync_adapter"),
                None,
            )
        try:
            raw_token_payload = self.secrets.retrieve_secret(account.refresh_token_secret_ref)
            token_payload = json.loads(raw_token_payload)
            if not isinstance(token_payload, dict):
                raise ValueError("Provider token payload must be an object.")
        except Exception:
            return (
                local_provider_fetch_result(account, local_date, reason="token_unavailable"),
                "Provider token secret is unavailable; workday source records used local fallback.",
            )
        try:
            return (
                asyncio.run(
                    self.reader.fetch_sources(
                        account,
                        token_payload,
                        local_date=local_date,
                    )
                ),
                None,
            )
        except ProviderReadError as exc:
            return (
                local_provider_fetch_result(account, local_date, reason="live_read_failed"),
                f"Provider live read failed; {exc.detail}",
            )
        except Exception as exc:
            return (
                local_provider_fetch_result(account, local_date, reason="live_read_failed"),
                f"Provider live read failed; {exc.__class__.__name__}.",
            )

    def _brain_available(self) -> bool:
        if self.brain is None:
            return True
        try:
            return asyncio.run(self.brain.check_available())
        except Exception:
            return False


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


