from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SystemCostUpsert(BaseModel):
    cpu_core_hour_rate: Decimal = Field(Decimal("0"), ge=0)
    gpu_hour_rate: Decimal = Field(Decimal("0"), ge=0)
    ram_gb_hour_rate: Decimal = Field(Decimal("0"), ge=0)
    vram_gb_hour_rate: Decimal = Field(Decimal("0"), ge=0)
    currency: str = "USD"


class SystemCostOut(BaseModel):
    id: int
    system_id: int
    cpu_core_hour_rate: Decimal
    gpu_hour_rate: Decimal
    ram_gb_hour_rate: Decimal
    vram_gb_hour_rate: Decimal
    currency: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookingCost(BaseModel):
    booking_id: int
    system_id: int
    duration_hours: float
    cpu_cost: Decimal
    gpu_cost: Decimal
    ram_cost: Decimal
    vram_cost: Decimal
    total_cost: Decimal
    currency: str


class UserCostSummary(BaseModel):
    user_id: int
    username: Optional[str]
    total_cost: Decimal
    currency: str
    booking_count: int
