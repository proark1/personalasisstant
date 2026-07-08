from assistant_runtime.secrets.provider import EnvelopeSecretProvider, SecretNotFound


def test_secret_provider_encrypts_and_revokes_secret_values() -> None:
    provider = EnvelopeSecretProvider("phase0-test-master-key")
    secret_ref = provider.store_secret("telegram-bot-token-123", "telegram")
    envelope = provider.envelope(secret_ref)

    assert "telegram-bot-token-123" not in envelope.ciphertext
    assert provider.retrieve_secret(secret_ref) == "telegram-bot-token-123"

    provider.revoke_secret(secret_ref)

    try:
        provider.retrieve_secret(secret_ref)
    except SecretNotFound:
        pass
    else:
        raise AssertionError("revoked secret should not be readable")
