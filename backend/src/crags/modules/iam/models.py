from sqlalchemy import Column, Integer, String, Enum, ForeignKey
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)

    role = Column(Enum(UserRole))

    group_id = Column(Integer, ForeignKey("groups.id"))

    group = relationship("Group")