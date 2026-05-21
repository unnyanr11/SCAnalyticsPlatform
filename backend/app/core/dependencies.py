"""FastAPI dependency providers (DB session, Redis, pagination)."""

from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.redis   import get_redis_client
from redis.asyncio  import Redis


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session; auto-commit on success, rollback on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_redis() -> Redis:  # type: ignore[type-arg]
    """Return the shared Redis client."""
    return get_redis_client()


class Pagination:
    """Reusable limit/offset pagination dependency."""

    def __init__(
        self,
        limit:  int = Query(default=50,  ge=1, le=200),
        offset: int = Query(default=0,   ge=0),
    ) -> None:
        self.limit  = limit
        self.offset = offset


DbDep    = Depends(get_db)
RedisDep = Depends(get_redis)
PageDep  = Depends(Pagination)
