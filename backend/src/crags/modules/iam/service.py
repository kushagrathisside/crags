from __future__ import annotations

from datetime import datetime

from psycopg.types.range import Range
from sqlalchemy.orm import Session

from crags.core.config import settings
from crags.core.security import hash_password, verify_password
from crags.modules.iam.models import Group, User, UserRole
from crags.modules.scheduling.models import Booking, BookingStatus

ACTIVE_USAGE_STATUSES = [BookingStatus.REQUESTED, BookingStatus.CONFIRMED]


def role_from_external(role_value: str) -> UserRole:
    normalized = role_value.strip().upper()
    if normalized == "RESOURCE_ADMIN":
        normalized = "ADMIN"
    return UserRole(normalized)


def role_to_external(role: UserRole | None) -> str:
    if role == UserRole.ADMIN:
        return "RESOURCE_ADMIN"
    return role.value if role else UserRole.MEMBER.value


def serialize_group(group: Group) -> dict:
    return {
        "id": group.id,
        "group_name": group.name,
        "concurrent_cpu_quota": group.concurrent_cpu_quota,
        "concurrent_gpu_quota": group.concurrent_gpu_quota,
        "concurrent_ram_quota": group.concurrent_ram_quota,
        "concurrent_vram_quota": group.concurrent_vram_quota,
        "monthly_cpu_hours_quota": group.monthly_cpu_hours_quota,
        "monthly_gpu_hours_quota": group.monthly_gpu_hours_quota,
        "monthly_ram_gb_hours_quota": group.monthly_ram_gb_hours_quota,
        "monthly_vram_gb_hours_quota": group.monthly_vram_gb_hours_quota,
    }


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": role_to_external(user.role),
        "group_id": user.group_id,
        "group_name": user.group.name if user.group else None,
        "is_active": bool(user.is_active),
        "auth_provider": user.auth_provider or "local",
        "created_at": user.created_at,
        "last_login": user.last_login,
    }


def is_admin_role(role: UserRole | None) -> bool:
    return role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}


def is_super_admin(role: UserRole | None) -> bool:
    return role == UserRole.SUPER_ADMIN


def find_user_by_identifier(db: Session, identifier: str) -> User | None:
    trimmed = identifier.strip()
    if not trimmed:
        return None

    if "@" in trimmed:
        return db.query(User).filter(User.email == trimmed).first()

    return db.query(User).filter(User.username == trimmed).first()


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    user = find_user_by_identifier(db, identifier)
    if not user:
        return None

    if not user.is_active:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    user.last_login = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _validate_group_exists(db: Session, group_id: int | None) -> None:
    if group_id is None:
        return

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")


def list_groups(db: Session) -> list[dict]:
    groups = db.query(Group).order_by(Group.name.asc()).all()
    return [serialize_group(group) for group in groups]


def create_group(db: Session, payload: dict) -> dict:
    name = str(payload.get("group_name", "")).strip()
    if not name:
        raise ValueError("group_name is required")

    group = Group(
        name=name,
        concurrent_cpu_quota=payload.get("concurrent_cpu_quota"),
        concurrent_gpu_quota=payload.get("concurrent_gpu_quota"),
        concurrent_ram_quota=payload.get("concurrent_ram_quota"),
        concurrent_vram_quota=payload.get("concurrent_vram_quota"),
        monthly_cpu_hours_quota=payload.get("monthly_cpu_hours_quota"),
        monthly_gpu_hours_quota=payload.get("monthly_gpu_hours_quota"),
        monthly_ram_gb_hours_quota=payload.get("monthly_ram_gb_hours_quota"),
        monthly_vram_gb_hours_quota=payload.get("monthly_vram_gb_hours_quota"),
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return serialize_group(group)


def update_group(db: Session, group_id: int, payload: dict) -> dict:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")

    if "group_name" in payload and payload["group_name"] is not None:
        next_name = str(payload["group_name"]).strip()
        if not next_name:
            raise ValueError("group_name cannot be blank")
        group.name = next_name

    for field in (
        "concurrent_cpu_quota",
        "concurrent_gpu_quota",
        "concurrent_ram_quota",
        "concurrent_vram_quota",
        "monthly_cpu_hours_quota",
        "monthly_gpu_hours_quota",
        "monthly_ram_gb_hours_quota",
        "monthly_vram_gb_hours_quota",
    ):
        if field in payload:
            setattr(group, field, payload[field])

    db.add(group)
    db.commit()
    db.refresh(group)
    return serialize_group(group)


def list_users(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.id.asc()).all()
    return [serialize_user(user) for user in users]


def create_user(db: Session, payload: dict) -> dict:
    username = str(payload.get("username", "")).strip()
    if not username:
        raise ValueError("username is required")

    password = str(payload.get("password", "")).strip()
    if not password:
        raise ValueError("password is required")

    role = role_from_external(str(payload.get("role", "MEMBER")))
    group_id = payload.get("group_id")
    _validate_group_exists(db, group_id)

    user = User(
        username=username,
        email=str(payload.get("email")).strip() if payload.get("email") else None,
        hashed_password=hash_password(password),
        role=role,
        group_id=group_id,
        is_active=bool(payload.get("is_active", True)),
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


def update_user(db: Session, user_id: int, payload: dict) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    if "email" in payload:
        user.email = str(payload["email"]).strip() if payload["email"] else None

    if "group_id" in payload:
        _validate_group_exists(db, payload["group_id"])
        user.group_id = payload["group_id"]

    if "is_active" in payload and payload["is_active"] is not None:
        user.is_active = bool(payload["is_active"])

    if "role" in payload and payload["role"]:
        user.role = role_from_external(str(payload["role"]))

    if "password" in payload and payload["password"]:
        raw_password = str(payload["password"]).strip()
        if not raw_password:
            raise ValueError("password cannot be blank")
        user.hashed_password = hash_password(raw_password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


def list_group_members(db: Session, group_id: int) -> list[dict]:
    users = db.query(User).filter(User.group_id == group_id).order_by(User.id.asc()).all()
    return [serialize_user(user) for user in users]


def _month_window(month: str | None) -> tuple[datetime, datetime, str]:
    if month:
        try:
            year_text, month_text = month.split("-", 1)
            year = int(year_text)
            month_num = int(month_text)
        except Exception as exc:
            raise ValueError("month must be in YYYY-MM format") from exc
    else:
        now = datetime.utcnow()
        year = now.year
        month_num = now.month

    if month_num < 1 or month_num > 12:
        raise ValueError("month must be in YYYY-MM format")

    month_start = datetime(year, month_num, 1)
    if month_num == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month_num + 1, 1)

    return month_start, month_end, f"{year:04d}-{month_num:02d}"


def _overlap_hours(
    left_start: datetime,
    left_end: datetime,
    right_start: datetime,
    right_end: datetime,
) -> float:
    start = max(left_start, right_start)
    end = min(left_end, right_end)
    if end <= start:
        return 0.0
    return (end - start).total_seconds() / 3600


def group_usage_summary(db: Session, group_id: int, month: str | None) -> dict:
    month_start, month_end, month_label = _month_window(month)
    month_range = Range(month_start, month_end)

    bookings = (
        db.query(Booking)
        .join(User, User.id == Booking.user_id)
        .filter(
            User.group_id == group_id,
            Booking.status.in_(ACTIVE_USAGE_STATUSES),
            Booking.booking_period.op("&&")(month_range),
        )
        .all()
    )

    cpu_hours = 0.0
    gpu_hours = 0.0
    ram_gb_hours = 0.0
    vram_gb_hours = 0.0

    for booking in bookings:
        period = booking.booking_period
        if not period or period.lower is None or period.upper is None:
            continue

        hours = _overlap_hours(period.lower, period.upper, month_start, month_end)
        if hours <= 0:
            continue

        cpu_hours += hours * booking.req_cpu
        gpu_hours += hours * booking.req_gpu
        ram_gb_hours += hours * booking.req_ram
        vram_gb_hours += hours * booking.req_vram

    return {
        "group_id": group_id,
        "month": month_label,
        "cpu_hours": round(cpu_hours, 2),
        "gpu_hours": round(gpu_hours, 2),
        "ram_gb_hours": round(ram_gb_hours, 2),
        "vram_gb_hours": round(vram_gb_hours, 2),
        "bookings_count": len(bookings),
    }


def ensure_super_admin(db: Session) -> None:
    seed_password = settings.SUPERADMIN_PASSWORD.strip()
    if not seed_password:
        return

    username = settings.SUPERADMIN_USERNAME.strip()
    email = settings.SUPERADMIN_EMAIL.strip()
    group_name = settings.SUPERADMIN_GROUP_NAME.strip() or "platform-admins"

    group = db.query(Group).filter(Group.name == group_name).first()
    if not group:
        group = Group(name=group_name)
        db.add(group)
        db.flush()

    user = db.query(User).filter(User.username == username).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            username=username,
            email=email or None,
            hashed_password=hash_password(seed_password),
            role=UserRole.SUPER_ADMIN,
            group_id=group.id,
            is_active=True,
            auth_provider="local",
        )
        db.add(user)
        db.commit()
        return

    user.role = UserRole.SUPER_ADMIN
    user.group_id = group.id
    user.is_active = True
    if email:
        user.email = email
    if not user.hashed_password:
        user.hashed_password = hash_password(seed_password)

    db.add(user)
    db.commit()
