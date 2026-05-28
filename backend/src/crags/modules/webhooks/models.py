import json
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Session

from crags.db.base import Base


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    url = Column(Text, nullable=False)
    events = Column(Text, nullable=False, default="[]")  # JSON-encoded list[str]
    secret = Column(String(128), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_triggered_at = Column(DateTime, nullable=True)
    last_status_code = Column(Integer, nullable=True)

    def get_events(self) -> list[str]:
        try:
            return json.loads(self.events or "[]")
        except Exception:
            return []

    def set_events(self, events: list[str]) -> None:
        self.events = json.dumps(events)
