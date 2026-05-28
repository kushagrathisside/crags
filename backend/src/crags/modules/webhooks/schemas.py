import json
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class WebhookCreate(BaseModel):
    name: str = Field(..., max_length=100)
    url: str
    events: list[str] = Field(default_factory=list)
    secret: Optional[str] = None
    active: bool = True

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v


class WebhookUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    url: Optional[str] = None
    events: Optional[list[str]] = None
    secret: Optional[str] = None
    active: Optional[bool] = None


class WebhookOut(BaseModel):
    id: int
    name: str
    url: str
    events: list[str]
    active: bool
    created_by: Optional[int]
    created_at: datetime
    last_triggered_at: Optional[datetime]
    last_status_code: Optional[int]

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Deserialize events from JSON string stored in the DB
        if hasattr(obj, "get_events"):
            data = {
                "id": obj.id, "name": obj.name, "url": obj.url,
                "events": obj.get_events(), "active": obj.active,
                "created_by": obj.created_by, "created_at": obj.created_at,
                "last_triggered_at": obj.last_triggered_at,
                "last_status_code": obj.last_status_code,
            }
            return cls(**data)
        return super().model_validate(obj, **kwargs)
