from __future__ import annotations

from typing import Any

from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import ActionRecord, JsonObject, PolicyDecision

# OneBrain target-architecture v2 §9 splits personal data into two tiers:
#
# - personal/{employee}/work-correspondence: the company-provided mailbox and
#   calendar. Company data that happens to be per-employee; governance is
#   audited and notice-based.
# - personal/{employee}/assistant-private: drafts, notes, assistant
#   conversations and work-product. Break-glass access only.
#
# Everything else the assistant writes is company-level operational metadata
# (provider health, connected accounts, sync state, ...) and stays in the
# module's default operational space.

WORK_CORRESPONDENCE_RECORD_TYPES = frozenset(
    {
        "provider_message",
        "provider_calendar_event",
        "calendar_event",
    }
)

ASSISTANT_PRIVATE_RECORD_TYPES = frozenset(
    {
        "action",
        "assistant_setting",
        "brief",
        "calendar_focus_plan",
        "calendar_insight",
        "feedback",
        "follow_up",
        "follow_up_risk",
        "inbox_triage",
        "message",
        "notification_event",
        "notification_preference",
        "priority_item",
        "task",
        "teaching_signal",
        "telegram_binding",
        "transcript",
        "voice_transcript",
        "workday_brief",
    }
)


def space_for_record_type(
    record_type: str,
    default_space_id: str,
    *,
    work_correspondence_space_id: str,
    assistant_private_space_id: str,
) -> str:
    record_type = (record_type or "").strip()
    if record_type in WORK_CORRESPONDENCE_RECORD_TYPES and work_correspondence_space_id:
        return work_correspondence_space_id
    if record_type in ASSISTANT_PRIVATE_RECORD_TYPES and assistant_private_space_id:
        return assistant_private_space_id
    return default_space_id


class SpaceRoutingBrainClient:
    """Route assistant records into OneBrain's two-tier personal spaces.

    Wraps any ``BrainClient`` so every writer (and typed reads that name a
    record type) inherits the routing from one seam. Enabled only when both
    tier spaces are provisioned in OneBrain (see ``build_brain_client``);
    until then every record keeps the module's default space.
    """

    def __init__(
        self,
        inner: BrainClient,
        *,
        work_correspondence_space_id: str,
        assistant_private_space_id: str,
    ) -> None:
        self.inner = inner
        self.work_correspondence_space_id = work_correspondence_space_id
        self.assistant_private_space_id = assistant_private_space_id

    def _route(self, record_type: str, space_id: str) -> str:
        return space_for_record_type(
            record_type,
            space_id,
            work_correspondence_space_id=self.work_correspondence_space_id,
            assistant_private_space_id=self.assistant_private_space_id,
        )

    async def check_available(self) -> bool:
        return await self.inner.check_available()

    async def capabilities(self) -> JsonObject:
        return await self.inner.capabilities()

    async def create_assistant_record(self, **kwargs: Any) -> JsonObject:
        record_type = str(kwargs.get("record_type") or "")
        kwargs["space_id"] = self._route(record_type, str(kwargs.get("space_id") or ""))
        return await self.inner.create_assistant_record(**kwargs)

    async def get_assistant_record(self, record_id: str, **kwargs: Any) -> JsonObject:
        return await self.inner.get_assistant_record(record_id, **kwargs)

    async def list_assistant_records(self, **kwargs: Any) -> list[JsonObject]:
        record_type = str(kwargs.get("record_type") or "")
        if record_type:
            kwargs["space_id"] = self._route(record_type, str(kwargs.get("space_id") or ""))
        return await self.inner.list_assistant_records(**kwargs)

    async def record_audit_event(self, **kwargs: Any) -> JsonObject:
        return await self.inner.record_audit_event(**kwargs)

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None:
        await self.inner.record_action_audit(action, decision)

    async def list_tombstones(self, *, since: int = 0, limit: int = 100) -> JsonObject:
        return await self.inner.list_tombstones(since=since, limit=limit)

    async def ack_tombstone(self, tombstone_id: str) -> JsonObject:
        return await self.inner.ack_tombstone(tombstone_id)

    async def delete_record(
        self,
        *,
        source_ref: str,
        account_id: str = "",
        space_id: str = "",
    ) -> JsonObject:
        return await self.inner.delete_record(
            source_ref=source_ref, account_id=account_id, space_id=space_id
        )
