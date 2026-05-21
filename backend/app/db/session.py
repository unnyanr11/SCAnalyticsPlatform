"""Async SQLAlchemy engine and session factory."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_engine: AsyncEngine | None = None

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def init_db() -> None:
    global _engine  # noqa: PLW0603
    _engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    AsyncSessionLocal.configure(bind=_engine)


async def close_db() -> None:
    if _engine:
        await _engine.dispose()


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Database not initialised — call init_db() first")
    return _engine
