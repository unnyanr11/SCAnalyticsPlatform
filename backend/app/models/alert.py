"""alerts table — market / shortage alerts."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AlertRecord(Base, TimestampMixin):
    __tablename__ = "alerts"

    id:           Mapped[int]   = mapped_column(Integer,    primary_key=True, autoincrement=True)
    resource_id:  Mapped[int]   = mapped_column(Integer,    nullable=False, index=True)
    realm:        Mapped[int]   = mapped_column(SmallInteger, nullable=False, default=0)
    severity:     Mapped[str]   = mapped_column(String(10), nullable=False)  # info|warning|critical
    message:      Mapped[str]   = mapped_column(String(500), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged: Mapped[bool]  = mapped_column(Boolean, nullable=False, default=False)
