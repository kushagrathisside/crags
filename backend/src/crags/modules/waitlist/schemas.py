from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WaitlistJoin(BaseModel):
    system_id: int
    req_cpu: int = Field(0, ge=0)
    req_gpu: int = Field(0, ge=0)
    req_ram: int = Field(0, ge=0)
    req_vram: int = Field(0, ge=0)
    duration_hours: int = Field(..., ge=1)
    access_type: str = "FOREGROUND"
    academic_category: Optional[str] = None
    project_title: Optional[str] = None


class WaitlistEntryOut(BaseModel):
    id: int
    user_id: int
    system_id: int
    req_cpu: int
    req_gpu: int
    req_ram: int
    req_vram: int
    duration_hours: int
    access_type: str
    academic_category: Optional[str]
    project_title: Optional[str]
    status: str
    priority: int
    created_at: datetime
    notified_at: Optional[datetime]

    model_config = {"from_attributes": True}
