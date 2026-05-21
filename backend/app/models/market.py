"""
app/models/market.py
SQLAlchemy ORM models for the SC Analytics Platform.

Tables:
  - products           : product/resource reference catalogue
  - market_prices      : historical price + quantity snapshots
  - ai_predictions     : stored AI forecast results
  - economy_phases     : recorded economy phase history
  - alerts             : user-configured and system-generated alerts
  - watchlists         : user watchlist entries
  - volatility_metrics : per-product volatility history
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    production_time: Mapped[float] = mapped_column(Float, nullable=True)
    retail_price: Mapped[float] = mapped_column(Float, nullable=True)
    production_cost: Mapped[float] = mapped_column(Float, nullable=True)
    realm: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    prices: Mapped[list["MarketPrice"]] = relationship(
        back_populates="product", lazy="select"
    )
    predictions: Mapped[list["AIPrediction"]] = relationship(
        back_populates="product", lazy="select"
    )


# ---------------------------------------------------------------------------
# Market prices
# ---------------------------------------------------------------------------


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False)
    realm: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(100), nullable=True)  # simco / simcotools
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )

    product: Mapped["Product"] = relationship(back_populates="prices")


# ---------------------------------------------------------------------------
# AI Predictions
# ---------------------------------------------------------------------------


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_type: Mapped[str] = mapped_column(String(50))  # prophet / xgboost / lstm
    predicted_price: Mapped[float] = mapped_column(Float, nullable=True)
    predicted_margin_pct: Mapped[float] = mapped_column(Float, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)  # 0.0 – 1.0
    direction: Mapped[str] = mapped_column(String(20), nullable=True)  # up/down/stable
    reasoning: Mapped[str] = mapped_column(Text, nullable=True)
    shortage_prob: Mapped[float] = mapped_column(Float, nullable=True)
    oversaturation_risk: Mapped[float] = mapped_column(Float, nullable=True)
    horizon_hours: Mapped[int] = mapped_column(Integer, default=24)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="predictions")


# ---------------------------------------------------------------------------
# Economy phases
# ---------------------------------------------------------------------------


class EconomyPhase(Base):
    __tablename__ = "economy_phases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    realm: Mapped[int] = mapped_column(Integer, default=0, index=True)
    phase: Mapped[str] = mapped_column(String(50))  # boom/stable/recession/recovery
    raw_data: Mapped[str] = mapped_column(Text, nullable=True)  # JSON blob
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    alert_type: Mapped[str] = mapped_column(
        String(50)
    )  # shortage/spike/oversaturation/volatility/opportunity
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info/warning/critical
    message: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


# ---------------------------------------------------------------------------
# Watchlists
# ---------------------------------------------------------------------------


class WatchlistEntry(Base):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    note: Mapped[str] = mapped_column(String(500), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Volatility metrics
# ---------------------------------------------------------------------------


class VolatilityMetric(Base):
    __tablename__ = "volatility_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cv: Mapped[float] = mapped_column(Float)  # coefficient of variation
    std_dev: Mapped[float] = mapped_column(Float)
    sample_count: Mapped[int] = mapped_column(Integer)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
