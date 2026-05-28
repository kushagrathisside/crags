from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from crags.db.base import Base


class BookingPolicy(Base):
    __tablename__ = "booking_policies"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    # Per-booking hard limits (None = unlimited)
    max_duration_hours = Column(Integer, nullable=True)
    max_advance_days = Column(Integer, nullable=True)
    max_concurrent_bookings = Column(Integer, nullable=True)

    # Approval thresholds — booking goes to REQUESTED if any exceeded
    approval_required_above_gpu = Column(Integer, nullable=True)
    approval_required_above_cpu = Column(Integer, nullable=True)
    approval_required_above_ram_gb = Column(Integer, nullable=True)
    approval_required_above_hours = Column(Integer, nullable=True)
    always_require_approval = Column(Boolean, nullable=False, default=False)

    # Scope
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
