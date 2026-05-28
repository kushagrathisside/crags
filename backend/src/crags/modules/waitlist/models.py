from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from crags.db.base import Base


class WaitlistStatus(str):
    WAITING = "WAITING"
    PROMOTED = "PROMOTED"
    CANCELLED = "CANCELLED"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    system_id = Column(Integer, ForeignKey("compute_systems.id", ondelete="CASCADE"), nullable=False)
    req_cpu = Column(Integer, nullable=False, default=0)
    req_gpu = Column(Integer, nullable=False, default=0)
    req_ram = Column(Integer, nullable=False, default=0)
    req_vram = Column(Integer, nullable=False, default=0)
    duration_hours = Column(Integer, nullable=False)
    access_type = Column(String(20), nullable=False, default="FOREGROUND")
    academic_category = Column(String, nullable=True)
    project_title = Column(String, nullable=True)
    status = Column(String(20), nullable=False, default="WAITING")
    priority = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    notified_at = Column(DateTime(timezone=True), nullable=True)
