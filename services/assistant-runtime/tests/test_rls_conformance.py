"""Allow/deny conformance fixtures against real Postgres with RLS enabled.

Target-architecture v2 §20: authorization semantics must be proven where they
run, on real PostgreSQL with row-level security enabled, in every repo's CI.

These tests need a disposable database. They run when ASSISTANT_TEST_DATABASE_URL
is set (CI provides a service container) and skip otherwise.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from assistant_runtime.persistence.scope import (
    ALL_ACCOUNTS_SENTINEL,
    current_account_scope,
)
from assistant_runtime.schemas import ActionCreateRequest, ScopedIdentity, SessionRecord, utc_now

ADMIN_DATABASE_URL = os.getenv("ASSISTANT_TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not ADMIN_DATABASE_URL,
    reason="ASSISTANT_TEST_DATABASE_URL is not set; RLS conformance needs real Postgres.",
)

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"

ACCOUNT_A = "acct_alpha"
ACCOUNT_B = "acct_beta"

# Superusers bypass RLS no matter what, so the fixtures prove enforcement under a
# dedicated non-superuser application role — the same two-role split (owner for
# migrations, app for runtime) the deployment is expected to use.
APP_ROLE = "assistant_rls_app"
APP_PASSWORD = "assistant_rls_app"


def _app_dsn() -> str:
    from urllib.parse import urlsplit, urlunsplit

    parts = urlsplit(ADMIN_DATABASE_URL)
    host = parts.hostname or "localhost"
    port = f":{parts.port}" if parts.port else ""
    return urlunsplit(
        (parts.scheme, f"{APP_ROLE}:{APP_PASSWORD}@{host}{port}", parts.path, "", "")
    )


DATABASE_URL = ""  # resolved by the session fixture below


def _scope(account_id: str, space_id: str = "sp_main") -> ScopedIdentity:
    return ScopedIdentity(account_id=account_id, user_id="user_1", space_id=space_id)


def _raw_connect(set_scope: str | None, dsn: str = ""):
    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(dsn or DATABASE_URL, autocommit=True, row_factory=dict_row)
    if set_scope is not None:
        conn.execute(
            "SELECT set_config('assistant.account_scope', %s, false)", (set_scope,)
        )
    return conn


@pytest.fixture(scope="session", autouse=True)
def _migrated_database():
    global DATABASE_URL
    with _raw_connect(ALL_ACCOUNTS_SENTINEL, dsn=ADMIN_DATABASE_URL) as conn:
        for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
            conn.execute(migration.read_text(encoding="utf-8"))
        conn.execute(
            f"""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
                CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' NOSUPERUSER;
              END IF;
            END $$;
            """
        )
        conn.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
        conn.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"
        )
    DATABASE_URL = _app_dsn()


@pytest.fixture(autouse=True)
def _clean_tables():
    with _raw_connect(ALL_ACCOUNTS_SENTINEL) as conn:
        for table in (
            "assistant_outbox",
            "assistant_actions",
            "assistant_jobs",
            "assistant_sessions",
            "assistant_idempotency_keys",
            "assistant_onebrain_tombstone_state",
        ):
            conn.execute(f"DELETE FROM {table}")
    yield


@pytest.fixture
def _as_all_accounts():
    token = current_account_scope.set(ALL_ACCOUNTS_SENTINEL)
    yield
    current_account_scope.reset(token)


def _action_store():
    from assistant_runtime.persistence.postgres import PostgresActionStore

    return PostgresActionStore(DATABASE_URL)


def _session_store():
    from assistant_runtime.persistence.postgres import PostgresSessionStore

    return PostgresSessionStore(DATABASE_URL)


def _seed_action(account_id: str, idempotency_key: str):
    token = current_account_scope.set(ALL_ACCOUNTS_SENTINEL)
    try:
        return _action_store().create(
            ActionCreateRequest(scope=_scope(account_id), idempotency_key=idempotency_key)
        )
    finally:
        current_account_scope.reset(token)


def test_scoped_session_cannot_read_another_accounts_rows() -> None:
    ours = _seed_action(ACCOUNT_A, "rls-ours")
    theirs = _seed_action(ACCOUNT_B, "rls-theirs")

    token = current_account_scope.set(ACCOUNT_A)
    try:
        store = _action_store()
        assert store.get(ours.action_id) is not None
        assert store.get(theirs.action_id) is None
        visible_accounts = {action.scope.account_id for action in store.all()}
        assert visible_accounts == {ACCOUNT_A}
    finally:
        current_account_scope.reset(token)


def test_scoped_session_cannot_write_into_another_account() -> None:
    import psycopg

    token = current_account_scope.set(ACCOUNT_A)
    try:
        # "new row violates row-level security policy" is SQLSTATE 42501.
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            _action_store().create(
                ActionCreateRequest(scope=_scope(ACCOUNT_B), idempotency_key="rls-forged")
            )
    finally:
        current_account_scope.reset(token)


def test_unset_scope_is_denied_fail_closed() -> None:
    _seed_action(ACCOUNT_A, "rls-hidden")

    # A connection that never set the GUC sees nothing, even as the table owner
    # (FORCE ROW LEVEL SECURITY).
    with _raw_connect(set_scope=None) as conn:
        rows = conn.execute("SELECT action_id FROM assistant_actions").fetchall()
    assert rows == []


def test_all_accounts_sentinel_is_cross_scope(_as_all_accounts) -> None:
    _seed_action(ACCOUNT_A, "rls-a")
    _seed_action(ACCOUNT_B, "rls-b")

    visible_accounts = {action.scope.account_id for action in _action_store().all()}
    assert {ACCOUNT_A, ACCOUNT_B} <= visible_accounts


def test_postgres_purge_scope_erases_only_the_tombstoned_account(_as_all_accounts) -> None:
    _seed_action(ACCOUNT_A, "purge-a")
    _seed_action(ACCOUNT_B, "purge-b")
    sessions = _session_store()
    for account_id in (ACCOUNT_A, ACCOUNT_B):
        sessions.create_session(
            SessionRecord(
                scope=_scope(account_id),
                token_hash=f"hash-{account_id}",
                expires_at=utc_now(),
            )
        )

    assert _action_store().purge_scope(ACCOUNT_A) == 1
    assert sessions.purge_scope(ACCOUNT_A) == 1

    remaining = {action.scope.account_id for action in _action_store().all()}
    assert remaining == {ACCOUNT_B}


def test_postgres_tombstone_cursor_roundtrip(_as_all_accounts) -> None:
    from assistant_runtime.persistence.postgres import PostgresProviderStore

    store = PostgresProviderStore(DATABASE_URL)
    assert store.get_onebrain_tombstone_cursor(ACCOUNT_A) == 0
    store.set_onebrain_tombstone_cursor(ACCOUNT_A, 7)
    store.set_onebrain_tombstone_cursor(ACCOUNT_A, 3)  # never regresses
    assert store.get_onebrain_tombstone_cursor(ACCOUNT_A) == 7
