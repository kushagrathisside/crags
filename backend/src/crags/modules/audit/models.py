from enum import Enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime

from crags.db.base import Base


class AuditAction(str, Enum):
    # Booking lifecycle
    BOOKING_CREATED   = "BOOKING_CREATED"
    BOOKING_APPROVED  = "BOOKING_APPROVED"
    BOOKING_REJECTED  = "BOOKING_REJECTED"
    BOOKING_PREEMPTED = "BOOKING_PREEMPTED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    BOOKING_COMPLETED = "BOOKING_COMPLETED"
    BOOKING_EXTENDED  = "BOOKING_EXTENDED"
    BOOKING_RESIZED   = "BOOKING_RESIZED"
    # Auth events
    AUTH_LOGIN             = "AUTH_LOGIN"
    AUTH_FAILURE           = "AUTH_FAILURE"
    AUTH_LOGOUT            = "AUTH_LOGOUT"
    AUTH_REFRESH           = "AUTH_REFRESH"
    AUTH_RESET_REQUESTED   = "AUTH_RESET_REQUESTED"
    AUTH_RESET_COMPLETED   = "AUTH_RESET_COMPLETED"
    # Resource management
    SYSTEM_CREATED     = "SYSTEM_CREATED"
    SYSTEM_UPDATED     = "SYSTEM_UPDATED"
    SYSTEM_DELETED     = "SYSTEM_DELETED"
    MAINTENANCE_CREATED = "MAINTENANCE_CREATED"
    MAINTENANCE_DELETED = "MAINTENANCE_DELETED"
    # User / group management
    USER_CREATED  = "USER_CREATED"
    USER_UPDATED  = "USER_UPDATED"
    GROUP_CREATED = "GROUP_CREATED"
    GROUP_UPDATED = "GROUP_UPDATED"
    # Waitlist
    WAITLIST_JOINED    = "WAITLIST_JOINED"
    WAITLIST_PROMOTED  = "WAITLIST_PROMOTED"
    WAITLIST_CANCELLED = "WAITLIST_CANCELLED"
    # Policy
    POLICY_CREATED = "POLICY_CREATED"
    POLICY_UPDATED = "POLICY_UPDATED"
    POLICY_DELETED = "POLICY_DELETED"
    # Webhook
    WEBHOOK_CREATED = "WEBHOOK_CREATED"
    WEBHOOK_DELETED = "WEBHOOK_DELETED"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True)
    table_name = Column(String)
    record_id  = Column(Integer)
    action     = Column(String, nullable=False)
    timestamp  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_id    = Column(Integer)