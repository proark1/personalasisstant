from __future__ import annotations

import base64
import hashlib
from threading import RLock
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken

from assistant_runtime.schemas import SecretEnvelope, utc_now


def derive_fernet_key(master_key: str) -> bytes:
    digest = hashlib.sha256(master_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


class SecretNotFound(KeyError):
    pass


class EnvelopeSecretProvider:
    """Railway-friendly envelope baseline backed by an in-memory vault.

    Production storage must persist the returned encrypted envelope in Postgres
    or store a managed secret reference. Raw values never leave this provider.
    """

    def __init__(self, master_key: str, key_version: str = "v1") -> None:
        self._fernet = Fernet(derive_fernet_key(master_key))
        self.key_version = key_version
        self._lock = RLock()
        self._vault: dict[str, SecretEnvelope] = {}

    def store_secret(self, plaintext: str, purpose: str) -> str:
        secret_ref = f"secret://assistant/{purpose}/{uuid4()}"
        ciphertext = self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")
        with self._lock:
            self._vault[secret_ref] = SecretEnvelope(
                secret_ref=secret_ref,
                ciphertext=ciphertext,
                key_version=self.key_version,
            )
        return secret_ref

    def retrieve_secret(self, secret_ref: str) -> str:
        with self._lock:
            envelope = self._vault.get(secret_ref)
            if envelope is None or envelope.revoked_at is not None:
                raise SecretNotFound(secret_ref)
            envelope.last_used_at = utc_now()
        try:
            return self._fernet.decrypt(envelope.ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise SecretNotFound(secret_ref) from exc

    def revoke_secret(self, secret_ref: str) -> None:
        with self._lock:
            envelope = self._vault.get(secret_ref)
            if envelope is None:
                raise SecretNotFound(secret_ref)
            envelope.revoked_at = utc_now()

    def envelope(self, secret_ref: str) -> SecretEnvelope:
        with self._lock:
            envelope = self._vault.get(secret_ref)
            if envelope is None:
                raise SecretNotFound(secret_ref)
            return envelope
