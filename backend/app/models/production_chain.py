"""Production chain definitions.

A ProductionChain represents one complete manufacturing plan:
  - output product
  - buildings/factories needed
  - list of input products/quantities (stored as ProductionChainInputs)

This enables the Production Optimizer to evaluate chain profitability.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Float, Index, Integer,
    SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, RealmMixin


class ProductionChain(Base, TimestampMixin, RealmMixin):
    """A production recipe/chain for a specific output product."""

    __tablename__ = "production_chains"
    __table_args__ = (
        UniqueConstraint("product_id", "realm", "version", name="uq_chain_product_realm_version"),
        Index("ix_chain_product_realm", "product_id", "realm"),
        Index("ix_chain_category",      "output_category"),
        Index("ix_chain_profit_score",  "profit_score"),
    )

    id:         Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # --- Chain metadata ------------------------------------------------------
    name:             Mapped[str]           = mapped_column(String(200), nullable=False)
    output_category:  Mapped[str]           = mapped_column(String(80),  nullable=False)
    description:      Mapped[Optional[str]] = mapped_column(Text,        nullable=True)
    version:          Mapped[int]           = mapped_column(SmallInteger, nullable=False, default=1)

    # --- Economic analysis ---------------------------------------------------
    production_time_sec: Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    units_per_run:       Mapped[float] = mapped_column(Float,   nullable=False, default=1.0)
    estimated_cost:      Mapped[float] = mapped_column(Float,   nullable=False, default=0.0)
    estimated_revenue:   Mapped[float] = mapped_column(Float,   nullable=False, default=0.0)
    estimated_profit:    Mapped[float] = mapped_column(Float,   nullable=False, default=0.0)
    profit_per_hour:     Mapped[float] = mapped_column(Float,   nullable=False, default=0.0)
    profit_score:        Mapped[float] = mapped_column(Float,   nullable=False, default=0.0,
                                                        doc="Composite 0–100 score")
    roi_pct:             Mapped[float] = mapped_column(Float,   nullable=False, default=0.0)

    # --- Requirements --------------------------------------------------------
    min_building_level: Mapped[int]           = mapped_column(SmallInteger, nullable=False, default=1)
    buildings_required: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True,
                                                                doc="{building_key: count}")

    # --- Flags ---------------------------------------------------------------
    is_active:         Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_ai_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Saturation warning --------------------------------------------------
    saturation_risk: Mapped[float] = mapped_column(Float, nullable=True,
                                                    doc="0.0–1.0 market saturation risk")

    # --- Relationships -------------------------------------------------------
    product: Mapped["Product"] = relationship(
        back_populates="production_chains", lazy="noload",
        primaryjoin="ProductionChain.product_id == Product.id",
        foreign_keys=[product_id],
    )
    inputs: Mapped[list["ProductionChainInput"]] = relationship(
        back_populates="chain", cascade="all, delete-orphan", lazy="noload",
    )

    def __repr__(self) -> str:
        return (
            f"<ProductionChain id={self.id} product_id={self.product_id} "
            f"profit_score={self.profit_score:.1f}>"
        )


class ProductionChainInput(Base, RealmMixin):
    """One ingredient / input product required by a ProductionChain."""

    __tablename__ = "production_chain_inputs"
    __table_args__ = (
        Index("ix_pci_chain",      "chain_id"),
        Index("ix_pci_input_prod", "input_product_id"),
    )

    id:               Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chain_id:         Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    input_product_id: Mapped[int] = mapped_column(Integer, nullable=False)

    quantity:          Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    estimated_cost:    Mapped[float] = mapped_column(Float, nullable=False, default=0.0,
                                                      doc="Cost at current market VWAP")
    is_market_sourced: Mapped[bool]  = mapped_column(Boolean, nullable=False, default=True,
                                                      doc="False if self-produced")

    chain: Mapped["ProductionChain"] = relationship(
        back_populates="inputs", lazy="noload",
        primaryjoin="ProductionChainInput.chain_id == ProductionChain.id",
        foreign_keys=[chain_id],
    )

    def __repr__(self) -> str:
        return (
            f"<ChainInput chain={self.chain_id} "
            f"input={self.input_product_id} qty={self.quantity}>"
        )
