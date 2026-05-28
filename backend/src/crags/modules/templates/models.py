from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from crags.db.base import Base


class BookingTemplate(Base):
    __tablename__ = "booking_templates"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    system_id = Column(Integer, ForeignKey("compute_systems.id", ondelete="SET NULL"), nullable=True)
    req_cpu = Column(Integer, nullable=False, default=0)
    req_gpu = Column(Integer, nullable=False, default=0)
    req_ram = Column(Integer, nullable=False, default=0)
    req_vram = Column(Integer, nullable=False, default=0)
    duration_hours = Column(Integer, nullable=True)
    access_type = Column(String(20), nullable=False, default="FOREGROUND")
    academic_category = Column(String, nullable=True)
    project_title = Column(String, nullable=True)
    expected_deliverable = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
