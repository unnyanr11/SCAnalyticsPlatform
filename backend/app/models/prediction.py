"""AI prediction records — one row per AI inference run per product."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Float, Index,
    Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, RealmMixin


class AIPredictionRecord(Base, RealmMixin):
    """
    One AI inference result for a product.

    Signals:
        STRONG_BUY | BUY | HOLD | SELL | STRONG_SELL
        SHORTAGE_INCOMING | OVERSATURATED | ARBITRAGE
    """

    __tablename__ = "ai_predictions"
    __table_args__ = (
        Index("ix_pred_product_realm_time", "product_id", "realm", "generated_at"),
        Index("ix_pred_signal",             "signal",     "realm"),
        Index("ix_pred_confidence",          "confidence_score"),
        Index("ix_pred_generated_brin",      "generated_at", postgresql_using="brin"),
    )

    id:         Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(Integer,   nullable=False, index=True)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # --- Signal & confidence -------------------------------------------------
    signal:           Mapped[str]   = mapped_column(String(30),  nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float,       nullable=False,
                                                     doc="0.0 – 1.0")

    # --- Price targets -------------------------------------------------------
    predicted_margin:  Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                      doc="Expected profit margin %")
    price_target_low:  Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    price_target_high: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    predicted_roi:     Mapped[float] = mapped_column(Float, nullable=True)

    # --- Risk scores ---------------------------------------------------------
    shortage_risk: Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                  doc="0.0 – 1.0")
    oversat_risk:  Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                  doc="0.0 – 1.0")
    volatility:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # --- Explainability ------------------------------------------------------
    reasoning:     Mapped[str]           = mapped_column(Text,  nullable=False, default="")
    feature_importances: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    model_inputs:        Mapped[dict | None] = mapped_column(JSONB, nullable=True,
                                                              doc="Snapshot of features used")

    # --- Versioning ----------------------------------------------------------
    model_version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1.0.0")
    model_type:    Mapped[str] = mapped_column(String(40), nullable=False, default="xgboost",
                                                doc="xgboost | prophet | lstm | ensemble")

    product: Mapped["Product"] = relationship(back_populates="predictions", lazy="noload",
                                               primaryjoin="AIPredictionRecord.product_id == Product.id",
                                               foreign_keys=[product_id])

    def __repr__(self) -> str:
        return (
            f"<Prediction product_id={self.product_id} signal={self.signal} "
            f"conf={self.confidence_score:.2f}>"
        )
