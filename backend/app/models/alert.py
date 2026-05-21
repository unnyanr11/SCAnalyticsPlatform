"""Alert records — shortage warnings, opportunities, volatility spikes."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float,
    Index, Integer, SmallInteger, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, RealmMixin


class AlertRecord(Base, RealmMixin):
    """
    A triggered market alert.

    Alert types:
        SHORTAGE | OVERSATURATION | PRICE_SPIKE | ARBITRAGE
        VOLATILITY_SURGE | PHASE_CHANGE | AI_OPPORTUNITY

    Severities:  LOW | MEDIUM | HIGH | CRITICAL
    """

    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alert_product_realm",    "product_id", "realm"),
        Index("ix_alert_type_severity",    "alert_type", "severity"),
        Index("ix_alert_triggered_brin",   "triggered_at", postgresql_using="brin"),
        Index("ix_alert_acknowledged",     "acknowledged"),
    )

    id:         Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True,
                                                       doc="NULL for realm-wide alerts")

    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # --- Classification ------------------------------------------------------
    alert_type:    Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity:      Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    confidence:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # --- Content -------------------------------------------------------------
    title:   Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text,        nullable=False)
    icon:    Mapped[str] = mapped_column(String(10),  nullable=False, default="⚠",
                                          doc="Single emoji icon for the overlay badge")

    # --- Resolution ----------------------------------------------------------
    acknowledged:    Mapped[bool]          = mapped_column(Boolean, nullable=False, default=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Supporting data -----------------------------------------------------
    metrics:   Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True,
                                                       doc="Relevant metrics at trigger time")
    affected_product_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    product: Mapped[Optional["Product"]] = relationship(
        back_populates="alerts", lazy="noload",
        primaryjoin="AlertRecord.product_id == Product.id",
        foreign_keys=[product_id],
    )

    def __repr__(self) -> str:
        return (
            f"<Alert id={self.id} type={self.alert_type} "
            f"severity={self.severity} product_id={self.product_id}>"
        )
