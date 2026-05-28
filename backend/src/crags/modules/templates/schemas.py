from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TemplateCreate(BaseModel):
    name: str = Field(..., max_length=100)
    system_id: Optional[int] = None
    req_cpu: int = Field(0, ge=0)
    req_gpu: int = Field(0, ge=0)
    req_ram: int = Field(0, ge=0)
    req_vram: int = Field(0, ge=0)
    duration_hours: Optional[int] = Field(None, ge=1)
    access_type: str = "FOREGROUND"
    academic_category: Optional[str] = None
    project_title: Optional[str] = None
    expected_deliverable: Optional[str] = None
    objective: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    system_id: Optional[int] = None
    req_cpu: Optional[int] = Field(None, ge=0)
    req_gpu: Optional[int] = Field(None, ge=0)
    req_ram: Optional[int] = Field(None, ge=0)
    req_vram: Optional[int] = Field(None, ge=0)
    duration_hours: Optional[int] = Field(None, ge=1)
    access_type: Optional[str] = None
    academic_category: Optional[str] = None
    project_title: Optional[str] = None
    expected_deliverable: Optional[str] = None
    objective: Optional[str] = None


class TemplateOut(BaseModel):
    id: int
    user_id: int
    name: str
    system_id: Optional[int]
    req_cpu: int
    req_gpu: int
    req_ram: int
    req_vram: int
    duration_hours: Optional[int]
    access_type: str
    academic_category: Optional[str]
    project_title: Optional[str]
    expected_deliverable: Optional[str]
    objective: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
