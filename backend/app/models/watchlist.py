"""User watchlists — identified by an anonymous user_key from the extension."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Index,
    Integer, SmallInteger, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, RealmMixin


class WatchlistItem(Base, RealmMixin):
    """
    A single product tracked by one user (keyed by their anonymous extension key).
    Duplicate (user_key, product_id, realm) is prevented by a unique constraint.
    """

    __tablename__ = "watchlist_items"
    __table_args__ = (
        UniqueConstraint("user_key", "product_id", "realm", name="uq_watchlist_user_product_realm"),
        Index("ix_watchlist_user_key", "user_key"),
        Index("ix_watchlist_product",  "product_id", "realm"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_key:   Mapped[str] = mapped_column(String(128), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer,     nullable=False)

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    # --- User preferences per watched item -----------------------------------
    alert_on_shortage:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alert_on_oversat:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alert_on_price_spike: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    price_alert_threshold: Mapped[Optional[float]] = mapped_column(
        __import__("sqlalchemy").Float, nullable=True,
        doc="Trigger alert if price moves by this % from last check",
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<WatchlistItem user={self.user_key[:8]}... product_id={self.product_id}>"
