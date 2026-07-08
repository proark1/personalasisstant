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
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        validation_alias="CORS_ORIGINS",
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
