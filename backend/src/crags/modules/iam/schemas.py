from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str | None = None
    username: str | None = None
    email: str | None = None
    password: str

    def resolve_identifier(self) -> str:
        if self.identifier and self.identifier.strip():
            return self.identifier.strip()

        if self.username and self.username.strip():
            return self.username.strip()

        if self.email:
            return str(self.email)

        raise ValueError("Provide identifier, username, or email.")


class GroupQuotaPayload(BaseModel):
    concurrent_cpu_quota: int | None = Field(default=None, ge=0)
    concurrent_gpu_quota: int | None = Field(default=None, ge=0)
    concurrent_ram_quota: int | None = Field(default=None, ge=0)
    concurrent_vram_quota: int | None = Field(default=None, ge=0)
    monthly_cpu_hours_quota: float | None = Field(default=None, ge=0)
    monthly_gpu_hours_quota: float | None = Field(default=None, ge=0)
    monthly_ram_gb_hours_quota: float | None = Field(default=None, ge=0)
    monthly_vram_gb_hours_quota: float | None = Field(default=None, ge=0)


class GroupCreate(GroupQuotaPayload):
    group_name: str


class GroupUpdate(GroupQuotaPayload):
    group_name: str | None = None


class GroupResponse(GroupQuotaPayload):
    id: int
    group_name: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None = None
    role: str
    group_id: int | None = None
    group_name: str | None = None
    is_active: bool
    auth_provider: str
    created_at: datetime | None = None
    last_login: datetime | None = None


class UserCreate(BaseModel):
    username: str
    email: str | None = None
    password: str
    role: str = "MEMBER"
    group_id: int | None = None
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    group_id: int | None = None
    is_active: bool | None = None
    role: str | None = None
    password: str | None = None


class AuthSessionResponse(BaseModel):
    token_type: str = "cookie"
    user: UserResponse


class GroupUsageSummary(BaseModel):
    group_id: int
    month: str
    cpu_hours: float
    gpu_hours: float
    ram_gb_hours: float
    vram_gb_hours: float
    bookings_count: int
