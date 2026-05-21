"""
SC Analytics Platform — Application Settings

Pydantic BaseSettings with full environment variable support.
"""

from __future__ import annotations

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ----------------------------------------------------------------
    # Application
    # ----------------------------------------------------------------
    APP_NAME: str = "SC Analytics Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")

    # ----------------------------------------------------------------
    # Database
    # ----------------------------------------------------------------
    DATABASE_URL: str = "postgresql+asyncpg://scanalytics:password@localhost:5432/scanalytics"

    # ----------------------------------------------------------------
    # Redis
    # ----------------------------------------------------------------
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 60

    # ----------------------------------------------------------------
    # Security
    # ----------------------------------------------------------------
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: list[str] = [
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # ----------------------------------------------------------------
    # External APIs
    # ----------------------------------------------------------------
    SIMCO_API_BASE: AnyHttpUrl = "https://www.simcompanies.com"  # type: ignore[assignment]
    SIMCOTOOLS_API_BASE: AnyHttpUrl = "https://simcotools.app"  # type: ignore[assignment]
    SIMCOTOOLS_ALT_BASE: AnyHttpUrl = "https://api.simcotools.com"  # type: ignore[assignment]
    API_RATE_LIMIT_DELAY_MS: int = 500

    # ----------------------------------------------------------------
    # AI / ML
    # ----------------------------------------------------------------
    MODEL_CACHE_DIR: str = "./models"
    PROPHET_FORECAST_HORIZON_HOURS: int = 24
    XGBOOST_N_ESTIMATORS: int = 200

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
