from __future__ import annotations

from dataclasses import dataclass

from assistant_runtime.channels.telegram import TelegramChannel
from assistant_runtime.config import Settings
from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.domain.outbox import InMemoryOutboxStore
from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.domain.queue import InMemoryQueueProvider, InMemorySchedulerProvider
from assistant_runtime.domain.sessions import InMemorySessionStore
from assistant_runtime.interfaces import SecretProvider, SessionStore
from assistant_runtime.secrets.provider import EnvelopeSecretProvider


@dataclass
class OperationalStores:
    actions: InMemoryActionStore
    outbox: InMemoryOutboxStore
    queue: InMemoryQueueProvider
    scheduler: InMemorySchedulerProvider
    secrets: SecretProvider
    telegram: TelegramChannel
    providers: InMemoryProviderStore
    sessions: SessionStore


def build_operational_stores(settings: Settings) -> OperationalStores:
    if settings.use_postgres_operational_store:
        from assistant_runtime.persistence.postgres import (
            PostgresActionStore,
            PostgresJobStore,
            PostgresOutboxStore,
            PostgresProviderStore,
            PostgresSecretProvider,
            PostgresSessionStore,
            PostgresTelegramBindingStore,
        )

        secrets = PostgresSecretProvider(settings.database_url, settings.secret_master_key)
        telegram_bindings = PostgresTelegramBindingStore(settings.database_url)
        queue = PostgresJobStore(settings.database_url)
        return OperationalStores(
            actions=PostgresActionStore(settings.database_url),
            outbox=PostgresOutboxStore(settings.database_url),
            queue=queue,
            scheduler=InMemorySchedulerProvider(queue),
            secrets=secrets,
            telegram=TelegramChannel(secrets, binding_store=telegram_bindings),
            providers=PostgresProviderStore(settings.database_url),
            sessions=PostgresSessionStore(settings.database_url),
        )

    secrets = EnvelopeSecretProvider(settings.secret_master_key)
    queue = InMemoryQueueProvider()
    return OperationalStores(
        actions=InMemoryActionStore(),
        outbox=InMemoryOutboxStore(),
        queue=queue,
        scheduler=InMemorySchedulerProvider(queue),
        secrets=secrets,
        telegram=TelegramChannel(secrets),
        providers=InMemoryProviderStore(),
        sessions=InMemorySessionStore(),
    )
