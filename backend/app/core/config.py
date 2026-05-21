"""
app/core/config.py
Centralized settings loaded from environment variables via pydantic-settings.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str = "change-this-in-production"
    APP_ALLOWED_ORIGINS: List[str] = ["http://localhost:5173"]

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://sc_user:password@localhost:5432/sc_analytics"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL_SECONDS: int = 60

    # External data sources
    SIMCO_API_BASE: str = "https://www.simcompanies.com"
    SIMCOTOOLS_API_BASE: str = "https://simcotools.app"
    SIMCOTOOLS_ALT_API_BASE: str = "https://api.simcotools.com"
    SIMCO_REALM: int = 0

    # Rate limiting
    MAX_REQUESTS_PER_MINUTE: int = 30

    # Optional notifications
    DISCORD_WEBHOOK_URL: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""


settings = Settings()
