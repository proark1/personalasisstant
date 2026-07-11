from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="local", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    service_name: str = Field(default="assistant-api", validation_alias="SERVICE_NAME")

    onebrain_api_base_url: str = Field(
        default="http://localhost:8080", validation_alias="ONEBRAIN_API_BASE_URL"
    )
    onebrain_service_key: str = Field(default="", validation_alias="ONEBRAIN_SERVICE_KEY")
    onebrain_account_id: str = Field(default="acct_demo", validation_alias="ONEBRAIN_ACCOUNT_ID")
    onebrain_space_id: str = Field(default="space_demo", validation_alias="ONEBRAIN_SPACE_ID")
    onebrain_available: bool = Field(default=True, validation_alias="ONEBRAIN_AVAILABLE")
    onebrain_client_mode: str = Field(default="auto", validation_alias="ONEBRAIN_CLIENT_MODE")
    onebrain_timeout_seconds: float = Field(
        default=10.0,
        validation_alias="ONEBRAIN_TIMEOUT_SECONDS",
    )
    onebrain_tombstone_poll_seconds: int = Field(
        default=300,
        validation_alias="ONEBRAIN_TOMBSTONE_POLL_SECONDS",
    )
    # Two-tier personal spaces (target-architecture v2 §9). Leave both empty until
    # OneBrain provisions the tier spaces; routing then activates on its own.
    onebrain_work_correspondence_space_id: str = Field(
        default="", validation_alias="ONEBRAIN_WORK_CORRESPONDENCE_SPACE_ID"
    )
    onebrain_assistant_private_space_id: str = Field(
        default="", validation_alias="ONEBRAIN_ASSISTANT_PRIVATE_SPACE_ID"
    )

    database_url: str = Field(
        default="postgresql://assistant:assistant_dev_password@localhost:5432/assistant",
        validation_alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    operational_store: str = Field(default="auto", validation_alias="OPERATIONAL_STORE")

    secret_master_key: str = Field(
        default="local-dev-change-before-shipping", validation_alias="SECRET_MASTER_KEY"
    )
    telegram_webhook_secret: str = Field(
        default="local-telegram-webhook-secret", validation_alias="TELEGRAM_WEBHOOK_SECRET"
    )
    google_oauth_client_id: str = Field(default="", validation_alias="GOOGLE_OAUTH_CLIENT_ID")
    google_oauth_client_secret: str = Field(
        default="", validation_alias="GOOGLE_OAUTH_CLIENT_SECRET"
    )
    google_oauth_redirect_uri: str = Field(
        default="http://localhost:8000/v1/providers/oauth/google/callback",
        validation_alias="GOOGLE_OAUTH_REDIRECT_URI",
    )
    google_pubsub_topic: str = Field(default="", validation_alias="GOOGLE_PUBSUB_TOPIC")
    google_webhook_verification_token: str = Field(
        default="local-google-webhook-token",
        validation_alias="GOOGLE_WEBHOOK_VERIFICATION_TOKEN",
    )
    microsoft_oauth_client_id: str = Field(
        default="", validation_alias="MICROSOFT_OAUTH_CLIENT_ID"
    )
    microsoft_oauth_client_secret: str = Field(
        default="", validation_alias="MICROSOFT_OAUTH_CLIENT_SECRET"
    )
    microsoft_oauth_redirect_uri: str = Field(
        default="http://localhost:8000/v1/providers/oauth/microsoft/callback",
        validation_alias="MICROSOFT_OAUTH_REDIRECT_URI",
    )
    microsoft_tenant_id: str = Field(default="common", validation_alias="MICROSOFT_TENANT_ID")
    microsoft_webhook_client_state: str = Field(
        default="local-microsoft-webhook-state",
        validation_alias="MICROSOFT_WEBHOOK_CLIENT_STATE",
    )
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        validation_alias="CORS_ORIGINS",
    )

    auth_identity_mode: str = Field(default="auto", validation_alias="AUTH_IDENTITY_MODE")
    # Assistant sessions never re-validate against OneBrain after login, so this TTL
    # is the worst-case window an offboarded/revoked OneBrain user keeps assistant
    # access. Keep it short until OneBrain entitlement tokens replace the login shim.
    auth_session_ttl_seconds: int = Field(
        default=14400, validation_alias="AUTH_SESSION_TTL_SECONDS"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def use_postgres_operational_store(self) -> bool:
        if self.operational_store == "postgres":
            return True
        if self.operational_store == "memory":
            return False
        return self.environment.lower() in {"production", "staging"}

    @property
    def resolved_auth_identity_mode(self) -> str:
        """Which IdentityProvider mints sessions.

        ``stub`` mints sessions locally for dev/tests; ``onebrain`` delegates to the
        (deferred) OneBrain identity authority so login fails closed until it ships.
        ``auto`` selects ``onebrain`` in production/staging and ``stub`` elsewhere.
        """
        mode = self.auth_identity_mode.lower()
        if mode != "auto":
            return mode
        return "onebrain" if self.environment.lower() in {"production", "staging"} else "stub"

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.google_oauth_client_id and self.google_oauth_client_secret)

    @property
    def microsoft_oauth_configured(self) -> bool:
        return bool(self.microsoft_oauth_client_id and self.microsoft_oauth_client_secret)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
