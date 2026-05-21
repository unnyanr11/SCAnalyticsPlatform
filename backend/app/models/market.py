"""market_prices table — time-series of intercepted market snapshots."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Float, Index, Integer, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class MarketPrice(Base, TimestampMixin):
    __tablename__ = "market_prices"

    id:              Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    resource_id:     Mapped[int]      = mapped_column(Integer,   nullable=False, index=True)
    realm:           Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=0)
    observed_at:     Mapped[datetime] = mapped_column(nullable=False)

    # Aggregated snapshot fields
    lowest_ask:      Mapped[float]    = mapped_column(Float, nullable=False)
    highest_ask:     Mapped[float]    = mapped_column(Float, nullable=False)
    vwap:            Mapped[float]    = mapped_column(Float, nullable=False)
    total_supply:    Mapped[float]    = mapped_column(Float, nullable=False)
    offer_count:     Mapped[int]      = mapped_column(Integer, nullable=False)
    demand_score:    Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    price_volatility:Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)

    __table_args__ = (
        Index("ix_market_prices_resource_realm_time",
              "resource_id", "realm", "observed_at"),
    )
