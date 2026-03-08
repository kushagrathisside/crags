from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

from crags.db.base import Base


class AuditLog(Base):

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)

    table_name = Column(String)
    record_id = Column(Integer)

    action = Column(String)

    timestamp = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer)