from sqlalchemy import Column, Integer, String, Enum
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

    status = Column(Enum(SystemStatus))