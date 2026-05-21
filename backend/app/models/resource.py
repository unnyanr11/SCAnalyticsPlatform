"""Legacy resource model kept for backwards compatibility.
New code should use Product. This will be removed in a future migration.
"""

from __future__ import annotations

from typing import Any, List

from sqlalchemy import BigInteger, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, RealmMixin


class Resource(Base, TimestampMixin, RealmMixin):
    """[Deprecated] Use Product instead."""

    __tablename__ = "resources"

    id:              Mapped[int]   = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    key:             Mapped[str]   = mapped_column(String(120), nullable=False)
    name:            Mapped[str]   = mapped_column(String(200), nullable=False)
    category:        Mapped[str]   = mapped_column(String(80),  nullable=False, index=True)
    retail_price:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    units_per_run:   Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    production_time: Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    ingredients:     Mapped[Any]   = mapped_column(JSONB, nullable=True)
    quality_tiers:   Mapped[Any]   = mapped_column(JSONB, nullable=True)
