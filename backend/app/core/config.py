"""Centralised configuration via pydantic-settings (reads from .env)."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ App
    APP_NAME:    str  = "SCAnalyticsPlatform"
    DEBUG:       bool = False
    API_PREFIX:  str  = "/api/v1"
    SECRET_KEY:  str  = Field(..., min_length=32)

    # ------------------------------------------------------------ PostgreSQL
    POSTGRES_HOST:     str = "localhost"
    POSTGRES_PORT:     int = 5432
    POSTGRES_DB:       str = "scanalytics"
    POSTGRES_USER:     str = "scanalytics"
    POSTGRES_PASSWORD: str = Field(...)

    @property
    def DATABASE_URL(self) -> str:  # noqa: N802
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:  # noqa: N802
        """Used by Alembic (sync driver)."""
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # --------------------------------------------------------------- Redis
    REDIS_HOST:     str = "localhost"
    REDIS_PORT:     int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB:       int = 0

    @property
    def REDIS_URL(self) -> str:  # noqa: N802
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # -------------------------------------------------------------- CORS
    CORS_ORIGINS: List[str] = ["chrome-extension://*", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: object) -> List[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return list(v)  # type: ignore[arg-type]

    # ----------------------------------------------------------------- AI
    AI_PREDICTION_TTL_SECONDS: int = 300   # 5 min cache on predictions
    MARKET_HISTORY_LIMIT:      int = 60    # max snapshots per resource

    # ---------------------------------------------------------- Background
    WORKER_CONCURRENCY: int = 4


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings: Settings = get_settings()
