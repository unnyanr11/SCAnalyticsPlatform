"""Economy phase records."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, Index, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, RealmMixin


class EconomyPhaseRecord(Base, RealmMixin):
    """
    Snapshot of the SimCompanies economy phase for a realm.

    Phase codes (as used by SimCompanies API):
        0 = Stable  |  1 = Boom  |  2 = Recession  |  3 = Recovery
    """

    __tablename__ = "economy_phases"
    __table_args__ = (
        Index("ix_phase_realm_time", "realm", "observed_at"),
        Index("ix_phase_code",       "phase_code"),
    )

    id:   Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True,
    )
    ends_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # --- Phase identity ------------------------------------------------------
    phase_code:   Mapped[int]   = mapped_column(SmallInteger, nullable=False)
    phase_name:   Mapped[str]   = mapped_column(String(40),   nullable=False)
    multiplier:   Mapped[float] = mapped_column(Float,        nullable=False, default=1.0,
                                                 doc="Retail price multiplier for this phase")
    duration_hrs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True,
                                                         doc="Planned phase duration in hours")

    # --- Strategy hints (AI-generated, stored for cache) ---------------------
    strategy_hints: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # --- Source --------------------------------------------------------------
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="simcotools")

    def __repr__(self) -> str:
        return (
            f"<Phase realm={self.realm} code={self.phase_code} "
            f"name={self.phase_name!r} at={self.observed_at}>"
        )
