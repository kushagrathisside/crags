from typing import Optional

from pydantic import BaseModel, Field

from crags.modules.resources.models import SystemStatus, SystemType


class SystemCreate(BaseModel):
    name: str
    system_type: SystemType
    cpu_cores: int = Field(..., ge=1)
    ram_gb: int = Field(..., ge=1)
    gpu_units: int = Field(..., ge=0)
    vram_gb: int = Field(..., ge=0)
    status: SystemStatus = SystemStatus.ACTIVE


class SystemUpdate(BaseModel):
    name: Optional[str] = None
    system_type: Optional[SystemType] = None
    cpu_cores: Optional[int] = Field(None, ge=1)
    ram_gb: Optional[int] = Field(None, ge=1)
    gpu_units: Optional[int] = Field(None, ge=0)
    vram_gb: Optional[int] = Field(None, ge=0)
    status: Optional[SystemStatus] = None


class SystemResponse(BaseModel):
    id: int
    name: str
    system_type: SystemType
    cpu_cores: int
    ram_gb: int
    gpu_units: int
    vram_gb: int
    status: SystemStatus

    model_config = {"from_attributes": True}
