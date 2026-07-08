from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="local", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    service_name: str = Field(default="assistant-api", validation_alias="SERVICE_NAME")

    onebrain_api_url: str = Field(
        default="http://localhost:8080", validation_alias="ONEBRAIN_API_URL"
    )
    onebrain_available: bool = Field(default=True, validation_alias="ONEBRAIN_AVAILABLE")

    database_url: str = Field(
        default="postgresql://assistant:assistant_dev_password@localhost:5432/assistant",
        validation_alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")

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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
