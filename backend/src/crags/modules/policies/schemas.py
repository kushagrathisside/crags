from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    max_duration_hours: Optional[int] = Field(None, ge=1)
    max_advance_days: Optional[int] = Field(None, ge=1)
    max_concurrent_bookings: Optional[int] = Field(None, ge=1)
    approval_required_above_gpu: Optional[int] = Field(None, ge=0)
    approval_required_above_cpu: Optional[int] = Field(None, ge=0)
    approval_required_above_ram_gb: Optional[int] = Field(None, ge=0)
    approval_required_above_hours: Optional[int] = Field(None, ge=1)
    always_require_approval: bool = False
    group_id: Optional[int] = None
    is_default: bool = False


class PolicyUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    max_duration_hours: Optional[int] = Field(None, ge=1)
    max_advance_days: Optional[int] = Field(None, ge=1)
    max_concurrent_bookings: Optional[int] = Field(None, ge=1)
    approval_required_above_gpu: Optional[int] = Field(None, ge=0)
    approval_required_above_cpu: Optional[int] = Field(None, ge=0)
    approval_required_above_ram_gb: Optional[int] = Field(None, ge=0)
    approval_required_above_hours: Optional[int] = Field(None, ge=1)
    always_require_approval: Optional[bool] = None
    group_id: Optional[int] = None
    is_default: Optional[bool] = None


class PolicyOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    max_duration_hours: Optional[int]
    max_advance_days: Optional[int]
    max_concurrent_bookings: Optional[int]
    approval_required_above_gpu: Optional[int]
    approval_required_above_cpu: Optional[int]
    approval_required_above_ram_gb: Optional[int]
    approval_required_above_hours: Optional[int]
    always_require_approval: bool
    group_id: Optional[int]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PolicyCheckResult(BaseModel):
    requires_approval: bool
    violations: list[str]
