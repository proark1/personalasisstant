from __future__ import annotations

from assistant_runtime.contracts import (
    default_assistant_intent,
    purpose_for_record_type,
    record_type_for_telegram_event,
)
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import JsonObject, TelegramProvenanceEvent


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
