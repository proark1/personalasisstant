from __future__ import annotations

from dataclasses import dataclass


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
