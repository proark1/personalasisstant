from __future__ import annotations

import asyncio

import pytest

from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.queue import InMemoryQueueProvider
from assistant_runtime.domain.sessions import InMemorySessionStore, mint_session
from assistant_runtime.providers.onebrain import InMemoryBrainClient, OneBrainClientError
from assistant_runtime.providers.tombstones import (
    TOMBSTONE_POLL_JOB_TYPE,
    TombstoneConsumer,
)
from assistant_runtime.schemas import (
    ActionCreateRequest,
    JobRecord,
    OAuthScopeTier,
    ProviderKind,
    ScopedIdentity,
    utc_now,
)
from assistant_runtime.secrets.provider import EnvelopeSecretProvider, SecretNotFound

ACCOUNT = "acct_erase"
SPACE = "sp_erase"
OTHER_ACCOUNT = "acct_keep"


def _scope(account_id: str = ACCOUNT, space_id: str = SPACE) -> ScopedIdentity:
    return ScopedIdentity(account_id=account_id, user_id="user_1", space_id=space_id)


def _poll_job(scope: ScopedIdentity | None = None) -> JobRecord:
    scope = scope or _scope()
    return JobRecord(
        scope=scope,
        job_type=TOMBSTONE_POLL_JOB_TYPE,
        payload_ref="onebrain-tombstones://poll/300",
        idempotency_key=f"test-poll:{scope.account_id}:{utc_now().isoformat()}",
        timezone="UTC",
        run_at=utc_now(),
    )


def _consumer(**overrides) -> tuple[TombstoneConsumer, dict]:
    brain = overrides.get("brain", InMemoryBrainClient())
    secrets = EnvelopeSecretProvider("test-master-key")
    parts = {
        "brain": brain,
        "actions": InMemoryActionStore(),
        "outbox": InMemoryOutboxStore(),
        "queue": InMemoryQueueProvider(),
        "providers": InMemoryProviderStore(),
        "sessions": InMemorySessionStore(),
        "secrets": secrets,
    }
    parts.update(overrides)
    return TombstoneConsumer(**parts), parts


def test_account_tombstone_purges_operational_state_and_acks() -> None:
    consumer, parts = _consumer()
    brain = parts["brain"]
    secrets = parts["secrets"]

    parts["actions"].create(ActionCreateRequest(scope=_scope(), idempotency_key="erase-me"))
    parts["actions"].create(
        ActionCreateRequest(scope=_scope(OTHER_ACCOUNT), idempotency_key="keep-me")
    )
    token_ref = secrets.store_secret("refresh-token-value", "provider_token")
    parts["providers"].upsert_account(
        scope=_scope(),
        provider=ProviderKind.google,
        provider_subject="subject-1",
        email="user@erase.test",
        display_name="Erase Me",
        granted_scopes=[],
        scope_tier=OAuthScopeTier.read_only,
        refresh_token_secret_ref=token_ref,
    )
    _, session = mint_session(
        parts["sessions"], scope=_scope(), identity_source="test", ttl_seconds=3600
    )

    brain.add_tombstone(account_id=ACCOUNT, target_type="account", reason="erasure")
    consumer.process(_poll_job())

    remaining = [action.scope.account_id for action in parts["actions"]._actions.values()]
    assert remaining == [OTHER_ACCOUNT]
    assert parts["providers"].list_accounts() == []
    assert parts["sessions"].get_active_session_by_token_hash(session.token_hash) is None
    with pytest.raises(SecretNotFound):
        secrets.retrieve_secret(token_ref)
    assert brain.tombstone_acks == [brain.tombstones[0]["id"]]
    assert parts["providers"].get_onebrain_tombstone_cursor(ACCOUNT) == 1


def test_space_tombstone_purges_only_that_space() -> None:
    consumer, parts = _consumer()
    brain = parts["brain"]

    parts["actions"].create(
        ActionCreateRequest(scope=_scope(space_id="sp_doomed"), idempotency_key="doomed")
    )
    parts["actions"].create(
        ActionCreateRequest(scope=_scope(space_id="sp_alive"), idempotency_key="alive")
    )

    brain.add_tombstone(
        account_id=ACCOUNT, target_type="space", space_id="sp_doomed", reason="erasure"
    )
    consumer.process(_poll_job())

    remaining = [action.scope.space_id for action in parts["actions"]._actions.values()]
    assert remaining == ["sp_alive"]
    assert len(brain.tombstone_acks) == 1


def test_record_level_tombstone_acks_without_purging() -> None:
    consumer, parts = _consumer()
    brain = parts["brain"]
    parts["actions"].create(ActionCreateRequest(scope=_scope(), idempotency_key="stays"))

    brain.add_tombstone(
        account_id=ACCOUNT,
        target_type="document",
        target_ref="doc://something",
        reason="erasure",
    )
    consumer.process(_poll_job())

    assert len(parts["actions"]._actions) == 1
    assert len(brain.tombstone_acks) == 1
    assert parts["providers"].get_onebrain_tombstone_cursor(ACCOUNT) == 1


def test_poll_job_survives_onebrain_outage_and_reschedules() -> None:
    class OutageBrain(InMemoryBrainClient):
        async def list_tombstones(self, *, since: int = 0, limit: int = 100):
            raise OneBrainClientError(503, "unavailable")

    consumer, parts = _consumer(brain=OutageBrain())

    consumer.process(_poll_job())

    pending = [job for job in parts["queue"].all() if job.job_type == TOMBSTONE_POLL_JOB_TYPE]
    assert len(pending) == 1
    assert pending[0].run_at > utc_now()


def test_cursor_does_not_advance_when_ack_fails() -> None:
    class AckFailsBrain(InMemoryBrainClient):
        async def ack_tombstone(self, tombstone_id: str):
            raise OneBrainClientError(503, "ack unavailable")

    brain = AckFailsBrain()
    consumer, parts = _consumer(brain=brain)
    brain.add_tombstone(account_id=ACCOUNT, target_type="account", reason="erasure")

    consumer.process(_poll_job())

    # Apply-then-ack: the purge ran, but the unacked tombstone stays on the feed
    # for the next poll, so the deletion is never silently reported complete.
    assert parts["providers"].get_onebrain_tombstone_cursor(ACCOUNT) == 0
    assert brain.tombstone_acks == []


def test_purge_never_deletes_the_poll_chain_itself() -> None:
    consumer, parts = _consumer()
    brain = parts["brain"]
    queue = parts["queue"]

    poll_job = _poll_job()
    queue.enqueue(poll_job)
    brain.add_tombstone(account_id=ACCOUNT, target_type="account", reason="erasure")

    consumer.process(poll_job)

    poll_jobs = [job for job in queue.all() if job.job_type == TOMBSTONE_POLL_JOB_TYPE]
    assert len(poll_jobs) >= 1


def test_ensure_scheduled_is_idempotent() -> None:
    consumer, parts = _consumer()

    first = consumer.ensure_scheduled(_scope())
    second = consumer.ensure_scheduled(_scope())

    assert first is not None
    assert second is None
    poll_jobs = [job for job in parts["queue"].all() if job.job_type == TOMBSTONE_POLL_JOB_TYPE]
    assert len(poll_jobs) == 1


def test_module_initiated_erasure_deletes_by_source_ref() -> None:
    brain = InMemoryBrainClient()
    record = asyncio.run(
        brain.create_assistant_record(
            content="hello",
            record_type="provider_message",
            purpose="assistant_workday",
            account_id=ACCOUNT,
            space_id=SPACE,
            source_ref="provider://message/1",
        )
    )
    assert record["id"] in brain.records

    response = asyncio.run(
        brain.delete_record(source_ref="provider://message/1", account_id=ACCOUNT)
    )

    assert response["deleted"] == 1
    assert brain.records == {}


def test_module_initiated_erasure_is_refused_under_legal_hold() -> None:
    brain = InMemoryBrainClient()
    brain.held_scopes.add((ACCOUNT, ""))

    with pytest.raises(OneBrainClientError) as excinfo:
        asyncio.run(brain.delete_record(source_ref="provider://message/1", account_id=ACCOUNT))

    assert excinfo.value.status_code == 409
