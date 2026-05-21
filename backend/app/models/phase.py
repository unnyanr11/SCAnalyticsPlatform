"""economy_phases table — phase observation history."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class EconomyPhaseRecord(Base, TimestampMixin):
    __tablename__ = "economy_phases"

    id:          Mapped[int]      = mapped_column(Integer,    primary_key=True, autoincrement=True)
    realm:       Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=0, index=True)
    name:        Mapped[str]      = mapped_column(String(20), nullable=False)
    code:        Mapped[int]      = mapped_column(SmallInteger, nullable=False)
    multiplier:  Mapped[float]    = mapped_column(Float, nullable=False, default=1.0)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at:     Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
