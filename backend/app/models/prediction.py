"""ai_predictions table — stored AI forecast results."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AIPredictionRecord(Base, TimestampMixin):
    __tablename__ = "ai_predictions"

    id:               Mapped[int]   = mapped_column(Integer,    primary_key=True, autoincrement=True)
    resource_id:      Mapped[int]   = mapped_column(Integer,    nullable=False, index=True)
    realm:            Mapped[int]   = mapped_column(SmallInteger, nullable=False, default=0)
    signal:           Mapped[str]   = mapped_column(String(30), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_margin: Mapped[float] = mapped_column(Float, nullable=False)
    shortage_risk:    Mapped[float] = mapped_column(Float, nullable=False)
    oversat_risk:     Mapped[float] = mapped_column(Float, nullable=False)
    price_target_low: Mapped[float] = mapped_column(Float, nullable=False)
    price_target_high:Mapped[float] = mapped_column(Float, nullable=False)
    reasoning:        Mapped[str]   = mapped_column(String(1000), nullable=False)
    model_version:    Mapped[str]   = mapped_column(String(40),  nullable=False)
    generated_at:     Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
