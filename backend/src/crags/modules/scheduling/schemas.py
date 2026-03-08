from pydantic import BaseModel
from datetime import datetime


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