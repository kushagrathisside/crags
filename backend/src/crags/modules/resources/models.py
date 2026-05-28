from sqlalchemy import Column, DateTime, Integer, String, Text, Enum
from crags.db.base import Base
import enum


class SystemType(enum.Enum):
    CPU = "CPU"
    GPU = "GPU"
    HYBRID = "HYBRID"


class SystemStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"


class ComputeSystem(Base):
    __tablename__ = "compute_systems"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True)

    system_type = Column(Enum(SystemType))

    cpu_cores = Column(Integer)
    ram_gb = Column(Integer)

    gpu_units = Column(Integer)
    vram_gb = Column(Integer)

    status = Column(Enum(SystemStatus), nullable=False, server_default="ACTIVE", default=SystemStatus.ACTIVE)

    # Health monitoring
    health_check_url = Column(Text, nullable=True)
    last_health_check_at = Column(DateTime(timezone=True), nullable=True)
    last_health_status = Column(String(20), nullable=True)