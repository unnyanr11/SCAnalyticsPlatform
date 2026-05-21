"""Volatility metrics — pre-aggregated rolling statistics per product.

Stored separately from market_prices to keep the hot time-series table lean
and allow the AI engine to query pre-computed indicators directly.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Float, Index, Integer, String, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, RealmMixin


class VolatilityMetric(Base, RealmMixin):
    """
    Rolling volatility window for one product.

    Windows: 1h | 4h | 24h | 7d
    Computed by the background AI worker and cached in Redis.
    """

    __tablename__ = "volatility_metrics"
    __table_args__ = (
        Index("ix_vol_product_window_time", "product_id", "window", "computed_at"),
        Index("ix_vol_computed_brin",       "computed_at", postgresql_using="brin"),
        Index("ix_vol_score",               "volatility_score"),
    )

    id:         Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(Integer,   nullable=False, index=True)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    window: Mapped[str] = mapped_column(String(10), nullable=False,
                                         doc="1h | 4h | 24h | 7d")

    # --- Core volatility stats -----------------------------------------------
    volatility_score:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                        doc="0.0–1.0 normalized")
    std_dev:             Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    coeff_variation:     Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                        doc="std_dev / mean")
    price_range_pct:     Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                        doc="(max - min) / min")

    # --- Trend stats ---------------------------------------------------------
    mean_price:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    price_change:  Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                  doc="% change over window")
    trend_slope:   Mapped[float] = mapped_column(Float, nullable=True,
                                                  doc="Linear regression slope")
    momentum_rsi:  Mapped[float] = mapped_column(Float, nullable=True,
                                                  doc="RSI-style momentum 0–100")

    # --- Supply/demand stats -------------------------------------------------
    avg_supply:       Mapped[float] = mapped_column(Float, nullable=True)
    supply_change:    Mapped[float] = mapped_column(Float, nullable=True)
    avg_offer_count:  Mapped[float] = mapped_column(Float, nullable=True)
    demand_trend:     Mapped[float] = mapped_column(Float, nullable=True)

    product: Mapped["Product"] = relationship(
        back_populates="volatility_metrics", lazy="noload",
        primaryjoin="VolatilityMetric.product_id == Product.id",
        foreign_keys=[product_id],
    )

    def __repr__(self) -> str:
        return (
            f"<Volatility product_id={self.product_id} window={self.window} "
            f"score={self.volatility_score:.3f}>"
        )
