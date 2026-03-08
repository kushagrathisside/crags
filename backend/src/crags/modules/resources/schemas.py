from pydantic import BaseModel


class SystemCreate(BaseModel):
    name: str
    system_type: str
    cpu_cores: int
    ram_gb: int
    gpu_units: int
    vram_gb: int


class SystemResponse(SystemCreate):
    id: int

    class Config:
        from_attributes = True