from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator


class MaintenanceWindowCreate(BaseModel):
    system_id: int
    start_time: datetime
    end_time: datetime
    reason: Optional[str] = None

    @model_validator(mode="after")
    def validate_window(self) -> "MaintenanceWindowCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class MaintenanceWindowOut(BaseModel):
    id: int
    system_id: int
    start_time: datetime
    end_time: datetime
    reason: Optional[str]
    created_by: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
