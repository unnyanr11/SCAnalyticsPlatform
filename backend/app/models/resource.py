"""resources table — encyclopedia data per realm."""

from __future__ import annotations

from sqlalchemy import Float, Integer, JSON, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Resource(Base, TimestampMixin):
    __tablename__ = "resources"

    id:              Mapped[int]   = mapped_column(Integer,    primary_key=True)
    realm:           Mapped[int]   = mapped_column(SmallInteger, nullable=False, default=0)
    key:             Mapped[str]   = mapped_column(String(120), nullable=False)
    name:            Mapped[str]   = mapped_column(String(200), nullable=False)
    category:        Mapped[str]   = mapped_column(String(80),  nullable=False)
    retail_price:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    units_per_run:   Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    production_time: Mapped[int]   = mapped_column(Integer, nullable=False, default=0)  # seconds
    ingredients:     Mapped[dict]  = mapped_column(JSON,   nullable=False, default=list)
    quality_tiers:   Mapped[dict]  = mapped_column(JSON,   nullable=False, default=list)

    __table_args__ = (
        UniqueConstraint("id", "realm", name="uq_resource_realm"),
    )
