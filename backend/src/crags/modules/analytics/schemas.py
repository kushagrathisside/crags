from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ResourceUsageEntry(BaseModel):
    user_id: int
    username: Optional[str]
    cpu_hours: float
    gpu_hours: float
    ram_gb_hours: float
    vram_gb_hours: float
    booking_count: int


class GroupUsageEntry(BaseModel):
    group_id: int
    group_name: Optional[str]
    cpu_hours: float
    gpu_hours: float
    ram_gb_hours: float
    vram_gb_hours: float
    booking_count: int


class SystemUtilizationEntry(BaseModel):
    system_id: int
    system_name: str
    cpu_utilization_pct: float
    gpu_utilization_pct: float
    ram_utilization_pct: float
    vram_utilization_pct: float
    booking_count: int
    active_hours: float


class AnalyticsSummary(BaseModel):
    from_time: datetime
    to_time: datetime
    total_bookings: int
    total_cpu_hours: float
    total_gpu_hours: float
    total_ram_gb_hours: float
    total_vram_gb_hours: float
    per_user: list[ResourceUsageEntry]
    per_group: list[GroupUsageEntry]
    per_system: list[SystemUtilizationEntry]
