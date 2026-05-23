from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from crags.db.base import Base
import enum


class UserRole(enum.Enum):
    MEMBER = "MEMBER"
    GROUP_LEAD = "GROUP_LEAD"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    concurrent_cpu_quota = Column(Integer, nullable=True)
    concurrent_gpu_quota = Column(Integer, nullable=True)
    concurrent_ram_quota = Column(Integer, nullable=True)
    concurrent_vram_quota = Column(Integer, nullable=True)
    monthly_cpu_hours_quota = Column(Float, nullable=True)
    monthly_gpu_hours_quota = Column(Float, nullable=True)
    monthly_ram_gb_hours_quota = Column(Float, nullable=True)
    monthly_vram_gb_hours_quota = Column(Float, nullable=True)

    users = relationship("User", back_populates="group")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    email = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=True)

    role = Column(Enum(UserRole))

    group_id = Column(Integer, ForeignKey("groups.id"))
    is_active = Column(Boolean, default=True, nullable=False)
    auth_provider = Column(String, default="local", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    group = relationship("Group", back_populates="users")
