"""Product (resource) catalogue — single source of truth for all tradeable items.

This table mirrors the SimCompanies encyclopedia endpoint and is refreshed
periodically by the market-data worker.  Every other table that references
an in-game item links back here via product_id + realm.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Float, Index, Integer,
    SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, RealmMixin


class Product(Base, TimestampMixin, RealmMixin):
    """Tradeable item / resource in a given realm."""

    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("realm", "sim_id", name="uq_products_realm_sim_id"),
        Index("ix_products_category_realm",  "category", "realm"),
        Index("ix_products_sim_id",           "sim_id"),
    )

    # --- Primary key ---------------------------------------------------------
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # --- SimCompanies identity -----------------------------------------------
    sim_id:      Mapped[int]           = mapped_column(Integer, nullable=False)
    key:         Mapped[str]           = mapped_column(String(120), nullable=False)
    name:        Mapped[str]           = mapped_column(String(200), nullable=False)
    category:    Mapped[str]           = mapped_column(String(80),  nullable=False, index=True)
    image_url:   Mapped[Optional[str]] = mapped_column(Text,        nullable=True)

    # --- Economics -----------------------------------------------------------
    retail_price:     Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    transport_cost:   Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    units_per_run:    Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    production_time:  Mapped[int]   = mapped_column(Integer, nullable=False, default=0,
                                                     doc="seconds per production run")
    quality_min:      Mapped[int]   = mapped_column(SmallInteger, nullable=False, default=1)
    quality_max:      Mapped[int]   = mapped_column(SmallInteger, nullable=False, default=5)

    # --- Classification flags ------------------------------------------------
    is_raw_material:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_tradeable:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_researchable:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- JSONB blobs for flexible data ---------------------------------------
    ingredients:   Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True,
                                                           doc="List of {id, qty} dicts")
    quality_tiers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True,
                                                           doc="Quality multiplier tables")
    extra_data:    Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # --- Relationships -------------------------------------------------------
    market_prices:     Mapped[list["MarketPrice"]]           = relationship(back_populates="product", lazy="noload")
    predictions:       Mapped[list["AIPredictionRecord"]]    = relationship(back_populates="product", lazy="noload")
    alerts:            Mapped[list["AlertRecord"]]           = relationship(back_populates="product", lazy="noload")
    volatility_metrics: Mapped[list["VolatilityMetric"]]    = relationship(back_populates="product", lazy="noload")
    market_events:     Mapped[list["HistoricalMarketEvent"]] = relationship(back_populates="product", lazy="noload")
    production_chains: Mapped[list["ProductionChain"]]      = relationship(back_populates="product", lazy="noload",
                                                                            foreign_keys="ProductionChain.product_id")

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r} realm={self.realm}>"
