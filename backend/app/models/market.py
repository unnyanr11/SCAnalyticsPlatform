"""Market price snapshots — the primary time-series table.

Design notes:
- Partitioned by observed_at month (via Supabase/TimescaleDB-compatible design)
- BRIN index on observed_at for time-range scans (much smaller than B-tree)
- Composite B-tree on (product_id, realm, observed_at DESC) for per-product history
- No FK cascade delete — price history must be preserved even if product changes
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Float, Index,
    Integer, SmallInteger, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, RealmMixin


class MarketPrice(Base, RealmMixin):
    """Single market snapshot for one product at one point in time."""

    __tablename__ = "market_prices"
    __table_args__ = (
        # Fast per-product history retrieval
        Index("ix_mp_product_realm_time", "product_id", "realm", "observed_at"),
        # BRIN index — very efficient for time-ordered appends
        Index("ix_mp_observed_brin", "observed_at", postgresql_using="brin"),
        # Support category-level scans via JOIN with products
        Index("ix_mp_realm_time", "realm", "observed_at"),
    )

    id:         Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int]      = mapped_column(Integer, nullable=False, index=True)
    quality:    Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=1)

    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True,
        server_default=func.now(),
    )

    # --- Price fields --------------------------------------------------------
    lowest_ask:    Mapped[float] = mapped_column(Float, nullable=False)
    highest_ask:   Mapped[float] = mapped_column(Float, nullable=False)
    vwap:          Mapped[float] = mapped_column(Float, nullable=False,
                                                  doc="Volume-weighted average price")
    price_24h_ago: Mapped[float] = mapped_column(Float, nullable=True)
    price_7d_ago:  Mapped[float] = mapped_column(Float, nullable=True)

    # --- Volume / supply fields ----------------------------------------------
    total_supply:  Mapped[float] = mapped_column(Float, nullable=False, default=0)
    offer_count:   Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    sold_last_1h:  Mapped[float] = mapped_column(Float, nullable=True)
    sold_last_24h: Mapped[float] = mapped_column(Float, nullable=True)

    # --- Derived signals (pre-computed for query speed) ----------------------
    demand_score:     Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    price_volatility: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    spread_pct:       Mapped[float] = mapped_column(Float, nullable=True,
                                                     doc="(highest_ask - lowest_ask) / vwap")
    momentum_1h:      Mapped[float] = mapped_column(Float, nullable=True)
    momentum_24h:     Mapped[float] = mapped_column(Float, nullable=True)

    # --- Source tracking -----------------------------------------------------
    source: Mapped[str] = mapped_column(
        __import__("sqlalchemy").String(40), nullable=False, default="extension",
        doc="extension | simcotools | simcompanies_api",
    )

    product: Mapped["Product"] = relationship(back_populates="market_prices", lazy="noload",
                                               primaryjoin="MarketPrice.product_id == Product.id",
                                               foreign_keys=[product_id])

    def __repr__(self) -> str:
        return (
            f"<MarketPrice product_id={self.product_id} "
            f"realm={self.realm} vwap={self.vwap} at={self.observed_at}>"
        )
