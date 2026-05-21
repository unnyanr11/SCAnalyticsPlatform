"""Resource / encyclopedia endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.resource   import Resource
from app.schemas.resource  import ResourceOut
from app.db.redis          import cache_get, cache_set

router = APIRouter()


@router.get("/", response_model=List[ResourceOut], summary="All resources for a realm")
async def list_resources(
    realm: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
) -> List[ResourceOut]:
    cache_key = f"resources:all:{realm}"
    cached = await cache_get(cache_key)
    if cached:
        return [ResourceOut.model_validate(r) for r in cached]

    result = await db.execute(
        select(Resource).where(Resource.realm == realm).order_by(Resource.name)
    )
    rows = result.scalars().all()
    data = [ResourceOut.model_validate(r) for r in rows]
    await cache_set(cache_key, [d.model_dump(mode="json") for d in data], ttl=3600)
    return data


@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(
    resource_id: int = Path(..., ge=1),
    realm:       int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
) -> ResourceOut:
    result = await db.execute(
        select(Resource).where(
            Resource.id == resource_id, Resource.realm == realm
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"Resource {resource_id} not found in realm {realm}")
    return ResourceOut.model_validate(row)
