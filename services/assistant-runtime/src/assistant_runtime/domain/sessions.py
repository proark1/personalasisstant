from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from threading import RLock
from typing import TYPE_CHECKING
from uuid import UUID

from assistant_runtime.schemas import ScopedIdentity, SessionRecord, utc_now

if TYPE_CHECKING:
    from assistant_runtime.interfaces import SessionStore


def new_session_token() -> str:
    """Opaque, high-entropy bearer token. The raw value is returned to the client once."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Lookup hash for a bearer token. Only this hash is persisted, never the raw token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def mint_session(
    store: SessionStore,
    *,
    scope: ScopedIdentity,
    identity_source: str,
    ttl_seconds: int,
) -> tuple[str, SessionRecord]:
    """Create a session and return ``(raw_token, record)``. The raw token is not stored."""
    token = new_session_token()
    record = SessionRecord(
        scope=scope,
        token_hash=hash_session_token(token),
        identity_source=identity_source,
        expires_at=utc_now() + timedelta(seconds=ttl_seconds),
    )
    store.create_session(record)
    return token, record


class InMemorySessionStore:
    """In-memory session store for local/dev/test. Stores only token hashes."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._by_id: dict[UUID, SessionRecord] = {}
        self._id_by_hash: dict[str, UUID] = {}

    def create_session(self, record: SessionRecord) -> SessionRecord:
        with self._lock:
            self._by_id[record.session_id] = record
            self._id_by_hash[record.token_hash] = record.session_id
        return record

    def get_active_session_by_token_hash(self, token_hash: str) -> SessionRecord | None:
        with self._lock:
            session_id = self._id_by_hash.get(token_hash)
            if session_id is None:
                return None
            record = self._by_id.get(session_id)
        if record is None or not record.is_active():
            return None
        return record

    def revoke_session(self, session_id: UUID) -> SessionRecord | None:
        with self._lock:
            record = self._by_id.get(session_id)
            if record is None:
                return None
            if record.revoked_at is None:
                record.revoked_at = utc_now()
            return record

    def touch(self, session_id: UUID) -> None:
        with self._lock:
            record = self._by_id.get(session_id)
            if record is not None:
                record.last_used_at = utc_now()

    def purge_scope(self, account_id: str, space_id: str = "") -> int:
        """Erase sessions for a tombstoned scope. Empty space = whole account.

        Deletion (not just revocation): the rows themselves are the operational copy
        a OneBrain erasure tombstone requires this module to remove.
        """
        with self._lock:
            doomed = [
                session_id
                for session_id, record in self._by_id.items()
                if record.scope.account_id == account_id
                and (not space_id or record.scope.space_id == space_id)
            ]
            for session_id in doomed:
                record = self._by_id.pop(session_id)
                self._id_by_hash.pop(record.token_hash, None)
            return len(doomed)
