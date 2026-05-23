from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AvailabilityQuery(BaseModel):
    start_time: datetime
    end_time: datetime


class BookingCreate(BaseModel):
    system_id: int
    start_time: datetime
    end_time: datetime

    req_cpu: int
    req_gpu: int
    req_ram: int
    req_vram: int

    access_type: str

    academic_category: str
    project_title: str
    expected_deliverable: str
    objective: str


class BookingRead(BaseModel):
    id: int
    system_id: int
    user_id: int | None

    start_time: datetime
    end_time: datetime

    req_cpu: int
    req_gpu: int
    req_ram: int
    req_vram: int

    access_type: str

    academic_category: str
    project_title: str
    expected_deliverable: str
    objective: str

    status: str

    model_config = ConfigDict(from_attributes=True)


class BookingConflictResponse(BaseModel):
    detail: str
    reason: str
    resource: str | None = None
    shortage: int | None = None
    overlap_window: dict[str, str] | None = None
    conflicting_booking_ids: list[int] = Field(default_factory=list)
    recommended_fixes: list[str] = Field(default_factory=list)
