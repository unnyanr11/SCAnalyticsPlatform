"""Watchlist endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.watchlist  import WatchlistItem
from app.schemas.watchlist import WatchlistItemIn, WatchlistItemOut

router = APIRouter()


def _user_key(x_user_key: str = Header(...)) -> str:
    if not x_user_key or len(x_user_key) < 4:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user key")
    return x_user_key


@router.get("/", response_model=List[WatchlistItemOut])
async def get_watchlist(
    user_key: str = Depends(_user_key),
    db: AsyncSession = Depends(get_db),
) -> List[WatchlistItemOut]:
    result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.user_key == user_key)
    )
    return [WatchlistItemOut.model_validate(r) for r in result.scalars().all()]


@router.post("/", status_code=201)
async def add_to_watchlist(
    payload:  WatchlistItemIn,
    user_key: str = Depends(_user_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = WatchlistItem(user_key=user_key, **payload.model_dump())
    db.add(item)
    return {"ok": True}


@router.delete("/{item_id}")
async def remove_from_watchlist(
    item_id:  int,
    user_key: str = Depends(_user_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.id == item_id,
            WatchlistItem.user_key == user_key,
        )
    )
    return {"ok": True}
