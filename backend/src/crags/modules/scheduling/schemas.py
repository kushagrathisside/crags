from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AvailabilityQuery(BaseModel):
    start_time: datetime
    end_time: datetime


def _as_utc(dt: datetime) -> datetime:
    """Return dt in UTC, treating naive datetimes as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class BookingCreate(BaseModel):
    system_id: int
    start_time: datetime
    end_time: datetime

    req_cpu: int = Field(..., ge=0)
    req_gpu: int = Field(..., ge=0)
    req_ram: int = Field(..., ge=0)
    req_vram: int = Field(..., ge=0)

    access_type: str

    academic_category: str
    project_title: str
    expected_deliverable: str
    objective: str

    @model_validator(mode="after")
    def validate_time_window(self) -> "BookingCreate":
        start = _as_utc(self.start_time)
        end   = _as_utc(self.end_time)
        now   = datetime.now(timezone.utc)

        if start >= end:
            raise ValueError("end_time must be strictly after start_time")
        if start <= now:
            raise ValueError("start_time must be in the future")

        return self


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

    approved_by: int | None = None
    approved_at: datetime | None = None
    rejection_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)


class BookingApproveRequest(BaseModel):
    pass


class BookingRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class BookingExtendRequest(BaseModel):
    new_end_time: datetime

    @model_validator(mode="after")
    def validate_new_end(self) -> "BookingExtendRequest":
        now = datetime.now(timezone.utc)
        end = _as_utc(self.new_end_time)
        if end <= now:
            raise ValueError("new_end_time must be in the future")
        return self


class BookingResizeRequest(BaseModel):
    req_cpu: int | None = Field(None, ge=0)
    req_gpu: int | None = Field(None, ge=0)
    req_ram: int | None = Field(None, ge=0)
    req_vram: int | None = Field(None, ge=0)


class BookingConflictResponse(BaseModel):
    detail: str
    reason: str
    resource: str | None = None
    shortage: int | None = None
    overlap_window: dict[str, str] | None = None
    conflicting_booking_ids: list[int] = Field(default_factory=list)
    recommended_fixes: list[str] = Field(default_factory=list)
