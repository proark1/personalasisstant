from __future__ import annotations

from datetime import datetime

from assistant_runtime.contracts import (
    default_assistant_intent,
    purpose_for_record_type,
    record_type_for_telegram_event,
)
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import (
    CalendarInsight,
    FollowUpRisk,
    InboxTriageItem,
    JsonObject,
    PriorityItem,
    ProviderAccountRecord,
    ProviderSubscriptionRecord,
    ScopedIdentity,
    SyncCursorRecord,
    TelegramProvenanceEvent,
    WorkdayBrief,
)


async def record_telegram_event(
    brain: BrainClient,
    event: TelegramProvenanceEvent,
) -> JsonObject:
    record_type = record_type_for_telegram_event(event.event_type)
    purpose = purpose_for_record_type(record_type)
    metadata: JsonObject = {
        "event_ref": event.event_ref,
        "event_type": event.event_type,
        "binding_id": str(event.binding_id),
        "provider_metadata": dict(event.provider_metadata),
        "correlation_id": event.correlation_id,
        "audit_correlation_id": event.audit_correlation_id,
        "content_trust": "untrusted" if event.event_type == "telegram.inbound.text" else "system",
    }
    provenance: JsonObject = {
        "channel": "telegram",
        "derived_from": [event.source_update_ref],
        "source_update_ref": event.source_update_ref,
    }
    retention: JsonObject = {
        "policy": "assistant_notification_default",
    }
    return await brain.create_assistant_record(
        content=event.sanitized_summary,
        title=_title_for_event(event.event_type),
        record_type=record_type,
        purpose=purpose,
        intent=default_assistant_intent(record_type),
        account_id=event.scope.account_id,
        space_id=event.scope.space_id,
        source="telegram",
        source_ref=event.source_update_ref,
        metadata=metadata,
        provenance=provenance,
        retention=retention,
    )


def _title_for_event(event_type: str) -> str:
    if event_type == "telegram.binding.verified":
        return "Telegram binding verified"
    if event_type == "telegram.inbound.text":
        return "Telegram inbound message"
    if event_type.startswith("telegram.command."):
        return "Telegram command"
    if event_type == "telegram.message.delivered":
        return "Telegram message delivered"
    return "Telegram notification event"


async def record_provider_account_connected(
    brain: BrainClient,
    account: ProviderAccountRecord,
) -> JsonObject:
    metadata: JsonObject = {
        "provider": str(account.provider),
        "provider_account_ref": account.provider_account_ref,
        "provider_subject": account.provider_subject,
        "email": account.email,
        "display_name": account.display_name,
        "granted_scopes": list(account.granted_scopes),
        "scope_tier": str(account.scope_tier),
        "mail_enabled": account.mail_enabled,
        "calendar_enabled": account.calendar_enabled,
        "secret_ref": account.refresh_token_secret_ref,
        "correlation_id": account.correlation_id,
        "audit_correlation_id": account.audit_correlation_id,
    }
    return await brain.create_assistant_record(
        content=f"{account.provider} account connected for read-only assistant sync.",
        title="Provider account connected",
        record_type="provider_account",
        purpose="assistant_connected_account",
        intent=default_assistant_intent("provider_account"),
        account_id=account.scope.account_id,
        space_id=account.scope.space_id,
        source="assistant-provider-oauth",
        source_ref=account.provider_account_ref,
        metadata=metadata,
        provenance={
            "provider": str(account.provider),
            "derived_from": [account.provider_account_ref],
        },
        retention={"policy": "assistant_connected_account_default"},
    )


async def record_provider_scope_grant(
    brain: BrainClient,
    account: ProviderAccountRecord,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{account.provider} scopes granted for {account.scope_tier}.",
        title="Provider scope grant",
        record_type="scope_grant",
        purpose="assistant_connected_account",
        intent=default_assistant_intent("scope_grant"),
        account_id=account.scope.account_id,
        space_id=account.scope.space_id,
        source="assistant-provider-oauth",
        source_ref=account.provider_account_ref,
        metadata={
            "provider": str(account.provider),
            "provider_account_ref": account.provider_account_ref,
            "granted_scopes": list(account.granted_scopes),
            "scope_tier": str(account.scope_tier),
            "secret_ref": account.refresh_token_secret_ref,
            "correlation_id": account.correlation_id,
            "audit_correlation_id": account.audit_correlation_id,
        },
        provenance={"provider": str(account.provider)},
        retention={"policy": "assistant_connected_account_default"},
    )


async def record_provider_health_event(
    brain: BrainClient,
    account: ProviderAccountRecord,
    detail: str,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=detail,
        title="Provider health",
        record_type="provider_health",
        purpose="assistant_provider_health",
        intent=default_assistant_intent("provider_health"),
        account_id=account.scope.account_id,
        space_id=account.scope.space_id,
        source="assistant-provider-sync",
        source_ref=account.provider_account_ref,
        metadata={
            "provider": str(account.provider),
            "provider_account_ref": account.provider_account_ref,
            "status": str(account.status),
            "sync_state": str(account.sync_state),
            "last_sync_error": account.last_sync_error,
            "correlation_id": account.correlation_id,
            "audit_correlation_id": account.audit_correlation_id,
        },
        provenance={"provider": str(account.provider)},
        retention={"policy": "assistant_provider_health_default"},
    )


async def record_sync_cursor_event(
    brain: BrainClient,
    cursor: SyncCursorRecord,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{cursor.provider} cursor advanced for {cursor.cursor_kind}.",
        title="Sync cursor advanced",
        record_type="sync_cursor",
        purpose="assistant_sync",
        intent=default_assistant_intent("sync_cursor"),
        account_id=cursor.scope.account_id,
        space_id=cursor.scope.space_id,
        source="assistant-provider-sync",
        source_ref=cursor.cursor_ref,
        metadata={
            "provider": str(cursor.provider),
            "provider_account_ref": cursor.provider_account_ref,
            "cursor_kind": cursor.cursor_kind,
            "cursor_ref": cursor.cursor_ref,
            "reconciliation_state": cursor.reconciliation_state,
            "correlation_id": cursor.correlation_id,
        },
        provenance={"provider": str(cursor.provider)},
        retention={"policy": "assistant_sync_default"},
    )


async def record_sync_subscription_event(
    brain: BrainClient,
    subscription: ProviderSubscriptionRecord,
) -> JsonObject:
    content = (
        f"{subscription.provider} subscription active for "
        f"{subscription.subscription_kind}."
    )
    return await brain.create_assistant_record(
        content=content,
        title="Sync subscription active",
        record_type="sync_subscription",
        purpose="assistant_sync",
        intent=default_assistant_intent("sync_subscription"),
        account_id=subscription.scope.account_id,
        space_id=subscription.scope.space_id,
        source="assistant-provider-sync",
        source_ref=subscription.subscription_ref,
        metadata={
            "provider": str(subscription.provider),
            "provider_account_ref": subscription.provider_account_ref,
            "subscription_kind": subscription.subscription_kind,
            "subscription_ref": subscription.subscription_ref,
            "resource_ref": subscription.resource_ref,
            "state": subscription.state,
            "expires_at": subscription.expires_at.isoformat()
            if subscription.expires_at is not None
            else None,
            "correlation_id": subscription.correlation_id,
        },
        provenance={"provider": str(subscription.provider)},
        retention={"policy": "assistant_sync_default"},
    )


async def record_provider_message_source(
    brain: BrainClient,
    account: ProviderAccountRecord,
    *,
    local_date: str,
    source_ref: str,
    subject: str,
    snippet: str,
    sender: str = "",
    recipients: list[str] | None = None,
    received_at: datetime | None = None,
    flags: list[str] | tuple[str, ...] = (),
    unread: bool = False,
    importance: str = "normal",
    attachment_count: int = 0,
    category_hints: list[str] | None = None,
) -> JsonObject:
    safe_subject = _safe_provider_text(subject, fallback="Provider message", limit=180)
    safe_snippet = _safe_provider_text(snippet, fallback=safe_subject, limit=1200)
    metadata: JsonObject = {
        "source_record_kind": "provider_message",
        "provider": str(account.provider),
        "provider_account_ref": account.provider_account_ref,
        "provider_subject_ref": account.provider_subject,
        "local_date": local_date,
        "subject": safe_subject,
        "sender": _safe_provider_text(sender, fallback="", limit=240),
        "recipients": [
            _safe_provider_text(recipient, fallback="", limit=240)
            for recipient in (recipients or [])
        ],
        "received_at": received_at.isoformat() if received_at is not None else None,
        "flags": list(flags),
        "unread": unread,
        "importance": importance,
        "attachment_count": max(0, attachment_count),
        "category_hints": list(category_hints or []),
        "content_trust": "untrusted_normalized",
        "correlation_id": account.correlation_id,
        "audit_correlation_id": account.audit_correlation_id,
    }
    return await brain.create_assistant_record(
        content=safe_snippet,
        title=safe_subject,
        record_type="provider_message",
        purpose="assistant_workday",
        intent=default_assistant_intent("provider_message"),
        account_id=account.scope.account_id,
        space_id=account.scope.space_id,
        source="assistant-provider-sync",
        source_ref=source_ref,
        metadata=metadata,
        provenance={
            "provider": str(account.provider),
            "derived_from": [account.provider_account_ref, source_ref],
            "normalizer": "provider-source.rules.v1",
        },
        retention={"policy": "assistant_workday_source_default"},
    )


async def record_provider_calendar_event_source(
    brain: BrainClient,
    account: ProviderAccountRecord,
    *,
    local_date: str,
    source_ref: str,
    title: str,
    detail: str,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    organizer: str = "",
    attendee_count: int = 0,
    has_location: bool = False,
    has_meeting_link: bool = False,
    busy_status: str = "busy",
    flags: list[str] | tuple[str, ...] = (),
) -> JsonObject:
    safe_title = _safe_provider_text(title, fallback="Provider calendar event", limit=180)
    safe_detail = _safe_provider_text(detail, fallback=safe_title, limit=1200)
    metadata: JsonObject = {
        "source_record_kind": "provider_calendar_event",
        "provider": str(account.provider),
        "provider_account_ref": account.provider_account_ref,
        "provider_subject_ref": account.provider_subject,
        "local_date": local_date,
        "title": safe_title,
        "starts_at": starts_at.isoformat() if starts_at is not None else None,
        "ends_at": ends_at.isoformat() if ends_at is not None else None,
        "organizer": _safe_provider_text(organizer, fallback="", limit=240),
        "attendee_count": max(0, attendee_count),
        "has_location": has_location,
        "has_meeting_link": has_meeting_link,
        "busy_status": busy_status,
        "flags": list(flags),
        "content_trust": "untrusted_normalized",
        "correlation_id": account.correlation_id,
        "audit_correlation_id": account.audit_correlation_id,
    }
    return await brain.create_assistant_record(
        content=safe_detail,
        title=safe_title,
        record_type="provider_calendar_event",
        purpose="assistant_workday",
        intent=default_assistant_intent("provider_calendar_event"),
        account_id=account.scope.account_id,
        space_id=account.scope.space_id,
        source="assistant-provider-sync",
        source_ref=source_ref,
        metadata=metadata,
        provenance={
            "provider": str(account.provider),
            "derived_from": [account.provider_account_ref, source_ref],
            "normalizer": "provider-source.rules.v1",
        },
        retention={"policy": "assistant_workday_source_default"},
    )


async def record_workday_brief(
    brain: BrainClient,
    scope: ScopedIdentity,
    brief: WorkdayBrief,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=brief.summary,
        title=brief.title,
        record_type="workday_brief",
        purpose="assistant_workday",
        intent=default_assistant_intent("workday_brief"),
        account_id=scope.account_id,
        space_id=scope.space_id,
        source="assistant-workday-loop",
        source_ref=f"onebrain://workday/{scope.account_id}/{brief.local_date}/brief",
        metadata={
            "brief_id": brief.brief_id,
            "local_date": brief.local_date,
            "items": [item.model_dump(mode="json") for item in brief.items],
            "confidence": brief.confidence,
            "partial_state": brief.partial_state.model_dump(mode="json"),
            "source_refs": list(brief.source_refs),
        },
        provenance={
            "derived_from": list(brief.source_refs),
            "generator": "workday.rules.v1",
        },
        retention={"policy": "assistant_workday_default"},
    )


def _safe_provider_text(value: str, *, fallback: str, limit: int) -> str:
    normalized = " ".join(str(value or "").replace("<", " ").replace(">", " ").split())
    if not normalized:
        normalized = fallback
    return normalized[:limit]


async def record_priority_item(
    brain: BrainClient,
    scope: ScopedIdentity,
    local_date: str,
    priority: PriorityItem,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{priority.title}: {priority.detail}",
        title=priority.title,
        record_type="priority_item",
        purpose="assistant_workday",
        intent=default_assistant_intent("priority_item"),
        account_id=scope.account_id,
        space_id=scope.space_id,
        source="assistant-workday-loop",
        source_ref=f"onebrain://workday/{scope.account_id}/{local_date}/priority/{priority.priority_id}",
        metadata={
            "local_date": local_date,
            **priority.model_dump(mode="json"),
        },
        provenance={
            "derived_from": list(priority.source_refs),
            "generator": "priority.rules.v1",
        },
        retention={"policy": "assistant_workday_default"},
    )


async def record_inbox_triage_item(
    brain: BrainClient,
    scope: ScopedIdentity,
    local_date: str,
    item: InboxTriageItem,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{item.category}: {item.subject}. {item.reason}",
        title=item.subject,
        record_type="inbox_triage",
        purpose="assistant_workday",
        intent=default_assistant_intent("inbox_triage"),
        account_id=scope.account_id,
        space_id=scope.space_id,
        source="assistant-workday-loop",
        source_ref=item.source_ref,
        metadata={
            "local_date": local_date,
            **item.model_dump(mode="json"),
        },
        provenance={
            "derived_from": [item.source_ref],
            "generator": "inbox-triage.rules.v1",
        },
        retention={"policy": "assistant_workday_default"},
    )


async def record_follow_up_risk(
    brain: BrainClient,
    scope: ScopedIdentity,
    local_date: str,
    risk: FollowUpRisk,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{risk.title}: {risk.detail}",
        title=risk.title,
        record_type="follow_up_risk",
        purpose="assistant_workday",
        intent=default_assistant_intent("follow_up_risk"),
        account_id=scope.account_id,
        space_id=scope.space_id,
        source="assistant-workday-loop",
        source_ref=risk.source_refs[0] if risk.source_refs else risk.risk_id,
        metadata={
            "local_date": local_date,
            **risk.model_dump(mode="json"),
        },
        provenance={
            "derived_from": list(risk.source_refs),
            "generator": "followup.rules.v1",
        },
        retention={"policy": "assistant_workday_default"},
    )


async def record_calendar_insight(
    brain: BrainClient,
    scope: ScopedIdentity,
    local_date: str,
    insight: CalendarInsight,
) -> JsonObject:
    return await brain.create_assistant_record(
        content=f"{insight.title}: {insight.detail}",
        title=insight.title,
        record_type="calendar_insight",
        purpose="assistant_workday",
        intent=default_assistant_intent("calendar_insight"),
        account_id=scope.account_id,
        space_id=scope.space_id,
        source="assistant-workday-loop",
        source_ref=f"onebrain://workday/{scope.account_id}/{local_date}/calendar/{insight.insight_id}",
        metadata={
            "local_date": local_date,
            **insight.model_dump(mode="json"),
        },
        provenance={
            "derived_from": list(insight.source_refs),
            "generator": "calendar-planning.rules.v1",
        },
        retention={"policy": "assistant_workday_default"},
    )
