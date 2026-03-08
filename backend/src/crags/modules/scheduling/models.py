from sqlalchemy import Column, Integer, ForeignKey, Enum, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import TSRANGE
from crags.db.base import Base
import enum


class AccessType(enum.Enum):
    FOREGROUND = "FOREGROUND"
    BACKGROUND = "BACKGROUND"


class BookingStatus(enum.Enum):
    REQUESTED = "REQUESTED"
    CONFIRMED = "CONFIRMED"
    PREEMPTED = "PREEMPTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True)

    system_id = Column(Integer, ForeignKey("compute_systems.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    booking_period = Column(TSRANGE)

    req_cpu = Column(Integer)
    req_gpu = Column(Integer)
    req_ram = Column(Integer)
    req_vram = Column(Integer)

    access_type = Column(Enum(AccessType))

    academic_category = Column(String)
    project_title = Column(String)
    expected_deliverable = Column(Text)
    objective = Column(Text)

    status = Column(Enum(BookingStatus))

    system = relationship("ComputeSystem")