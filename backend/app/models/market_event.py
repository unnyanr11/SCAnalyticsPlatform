"""Historical market events — notable anomalies, shortages, spikes logged for AI training."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float,
    Index, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, RealmMixin


class HistoricalMarketEvent(Base, RealmMixin):
    """
    A notable market event detected by the AI system.
    Used as ground-truth labels for future model training.

    Event types:
        SHORTAGE | OVERSATURATION | PRICE_SPIKE | PRICE_CRASH
        DEMAND_SURGE | SUPPLY_COLLAPSE | ARBITRAGE_WINDOW
        PHASE_DRIVEN_BOOM | PHASE_DRIVEN_RECESSION
    """

    __tablename__ = "historical_market_events"
    __table_args__ = (
        Index("ix_hme_product_realm",    "product_id", "realm"),
        Index("ix_hme_event_type",       "event_type"),
        Index("ix_hme_started_brin",     "started_at", postgresql_using="brin"),
        Index("ix_hme_ai_label",         "is_ai_labeled"),
    )

    id:         Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True,
                                                       doc="NULL for realm-wide events")

    # --- Event window --------------------------------------------------------
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- Event classification ------------------------------------------------
    event_type:  Mapped[str]   = mapped_column(String(50),  nullable=False, index=True)
    severity:    Mapped[str]   = mapped_column(String(20),  nullable=False, default="MEDIUM")
    description: Mapped[str]   = mapped_column(Text,        nullable=False, default="")
    magnitude:   Mapped[float] = mapped_column(Float,       nullable=False, default=0.0,
                                                doc="How extreme the event was (0–100)")

    # --- Snapshots at event start/end for ML training ------------------------
    price_at_start:    Mapped[Optional[float]] = mapped_column(Float,   nullable=True)
    price_at_end:      Mapped[Optional[float]] = mapped_column(Float,   nullable=True)
    price_change_pct:  Mapped[Optional[float]] = mapped_column(Float,   nullable=True)
    supply_at_start:   Mapped[Optional[float]] = mapped_column(Float,   nullable=True)
    supply_at_end:     Mapped[Optional[float]] = mapped_column(Float,   nullable=True)

    # --- Economy context -----------------------------------------------------
    phase_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True,
                                                       doc="Economy phase at event start")

    # --- AI metadata ---------------------------------------------------------
    is_ai_labeled: Mapped[bool]           = mapped_column(Boolean, nullable=False, default=True)
    ai_predicted:  Mapped[bool]           = mapped_column(Boolean, nullable=False, default=False,
                                                           doc="Was this event predicted by the AI?")
    prediction_id: Mapped[Optional[int]]  = mapped_column(Integer, nullable=True,
                                                           doc="FK to ai_predictions if predicted")
    raw_metrics:   Mapped[Optional[dict]] = mapped_column(JSONB,   nullable=True)

    product: Mapped[Optional["Product"]] = relationship(
        back_populates="market_events", lazy="noload",
        primaryjoin="HistoricalMarketEvent.product_id == Product.id",
        foreign_keys=[product_id],
    )

    def __repr__(self) -> str:
        return (
            f"<MarketEvent id={self.id} type={self.event_type} "
            f"product_id={self.product_id} at={self.started_at}>"
        )
