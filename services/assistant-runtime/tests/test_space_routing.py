from __future__ import annotations

import asyncio

from assistant_runtime.config import Settings
from assistant_runtime.providers.onebrain import InMemoryBrainClient, build_brain_client
from assistant_runtime.providers.space_routing import (
    SpaceRoutingBrainClient,
    space_for_record_type,
)

WORK = "sp_work_correspondence"
PRIVATE = "sp_assistant_private"
DEFAULT = "sp_operational"


def test_record_types_route_to_their_tier() -> None:
    kwargs = {
        "work_correspondence_space_id": WORK,
        "assistant_private_space_id": PRIVATE,
    }
    # Provider mirrors of the company mailbox/calendar -> work correspondence.
    assert space_for_record_type("provider_message", DEFAULT, **kwargs) == WORK
    assert space_for_record_type("provider_calendar_event", DEFAULT, **kwargs) == WORK
    # Assistant work-product and conversations -> assistant-private (break-glass only).
    assert space_for_record_type("workday_brief", DEFAULT, **kwargs) == PRIVATE
    assert space_for_record_type("voice_transcript", DEFAULT, **kwargs) == PRIVATE
    assert space_for_record_type("action", DEFAULT, **kwargs) == PRIVATE
    # Company-level operational metadata stays in the module's default space.
    assert space_for_record_type("provider_health", DEFAULT, **kwargs) == DEFAULT
    assert space_for_record_type("scope_grant", DEFAULT, **kwargs) == DEFAULT
    assert space_for_record_type("secret_reference", DEFAULT, **kwargs) == DEFAULT


def test_routing_is_inert_when_tier_spaces_are_not_provisioned() -> None:
    assert (
        space_for_record_type(
            "provider_message",
            DEFAULT,
            work_correspondence_space_id="",
            assistant_private_space_id="",
        )
        == DEFAULT
    )


def test_routing_client_rewrites_writes_and_typed_reads() -> None:
    inner = InMemoryBrainClient()
    client = SpaceRoutingBrainClient(
        inner, work_correspondence_space_id=WORK, assistant_private_space_id=PRIVATE
    )

    record = asyncio.run(
        client.create_assistant_record(
            content="mail",
            record_type="provider_message",
            purpose="assistant_workday",
            account_id="acct_1",
            space_id=DEFAULT,
        )
    )
    assert record["space_id"] == WORK

    listed = asyncio.run(
        client.list_assistant_records(
            account_id="acct_1", space_id=DEFAULT, record_type="provider_message"
        )
    )
    assert [row["id"] for row in listed] == [record["id"]]


def test_build_brain_client_wraps_only_when_configured() -> None:
    routed = build_brain_client(
        Settings(
            ONEBRAIN_CLIENT_MODE="memory",
            ONEBRAIN_WORK_CORRESPONDENCE_SPACE_ID=WORK,
            ONEBRAIN_ASSISTANT_PRIVATE_SPACE_ID=PRIVATE,
        )
    )
    assert isinstance(routed, SpaceRoutingBrainClient)

    unrouted = build_brain_client(Settings(ONEBRAIN_CLIENT_MODE="memory"))
    assert isinstance(unrouted, InMemoryBrainClient)
