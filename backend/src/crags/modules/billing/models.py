from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from crags.db.base import Base


class SystemCost(Base):
    __tablename__ = "system_costs"

    id = Column(Integer, primary_key=True)
    system_id = Column(Integer, ForeignKey("compute_systems.id", ondelete="CASCADE"), nullable=False, unique=True)
    cpu_core_hour_rate = Column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))
    gpu_hour_rate = Column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))
    ram_gb_hour_rate = Column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))
    vram_gb_hour_rate = Column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))
    currency = Column(String(10), nullable=False, default="USD")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
