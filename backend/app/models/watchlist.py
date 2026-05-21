"""watchlist_items table — per-user resource watchlists."""

from __future__ import annotations

from sqlalchemy import Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class WatchlistItem(Base, TimestampMixin):
    __tablename__ = "watchlist_items"

    id:          Mapped[int] = mapped_column(Integer,    primary_key=True, autoincrement=True)
    user_key:    Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    resource_id: Mapped[int] = mapped_column(Integer,    nullable=False)
    realm:       Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("user_key", "resource_id", "realm", name="uq_watchlist_user_resource"),
    )
