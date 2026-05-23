from __future__ import annotations

import math
from datetime import datetime, timezone

from psycopg.types.range import Range
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from crags.modules.audit.models import AuditLog
from crags.modules.iam.models import Group, User, UserRole
from crags.modules.resources.models import ComputeSystem
from crags.modules.scheduling.models import AccessType, Booking, BookingStatus


ACTIVE_CAPACITY_STATUSES = [
    BookingStatus.REQUESTED,
    BookingStatus.CONFIRMED,
]

ADMIN_ROLES = {UserRole.ADMIN, UserRole.SUPER_ADMIN}


class BookingConflictError(Exception):
    def __init__(
        self,
        *,
        detail: str,
        reason: str,
        resource: str | None = None,
        shortage: int | None = None,
        overlap_window: dict[str, str] | None = None,
        conflicting_booking_ids: list[int] | None = None,
        recommended_fixes: list[str] | None = None,
    ):
        super().__init__(detail)
        self.detail = detail
        self.reason = reason
        self.resource = resource
        self.shortage = shortage
        self.overlap_window = overlap_window
        self.conflicting_booking_ids = conflicting_booking_ids or []
        self.recommended_fixes = recommended_fixes or []

    def to_response(self) -> dict:
        return {
            "detail": self.detail,
            "reason": self.reason,
            "resource": self.resource,
            "shortage": self.shortage,
            "overlap_window": self.overlap_window,
            "conflicting_booking_ids": self.conflicting_booking_ids,
            "recommended_fixes": self.recommended_fixes,
        }


class BookingPermissionError(Exception):
    pass


class BookingNotFoundError(Exception):
    pass


def _serialize_overlap_window(start_time: datetime, end_time: datetime) -> dict[str, str]:
    return {
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
    }


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value

    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _normalize_window(start_time: datetime, end_time: datetime) -> tuple[datetime, datetime]:
    normalized_start = _to_utc_naive(start_time)
    normalized_end = _to_utc_naive(end_time)

    if normalized_end <= normalized_start:
        raise ValueError("end_time must be after start_time")

    return normalized_start, normalized_end


def _serialize_booking(booking: Booking) -> dict:
    period = booking.booking_period
    start_time = period.lower if period else None
    end_time = period.upper if period else None

    if start_time is None or end_time is None:
        raise ValueError("booking_period bounds are missing")

    return {
        "id": booking.id,
        "system_id": booking.system_id,
        "user_id": booking.user_id,
        "start_time": start_time,
        "end_time": end_time,
        "req_cpu": booking.req_cpu,
        "req_gpu": booking.req_gpu,
        "req_ram": booking.req_ram,
        "req_vram": booking.req_vram,
        "access_type": booking.access_type.value if booking.access_type else "BACKGROUND",
        "academic_category": booking.academic_category,
        "project_title": booking.project_title,
        "expected_deliverable": booking.expected_deliverable,
        "objective": booking.objective,
        "status": booking.status.value if booking.status else "REQUESTED",
    }


def _scope_query_for_actor(query: Query, actor_user: User) -> Query:
    if actor_user.role in ADMIN_ROLES:
        return query

    if actor_user.role == UserRole.GROUP_LEAD and actor_user.group_id is not None:
        return query.join(User, User.id == Booking.user_id).filter(User.group_id == actor_user.group_id)

    return query.filter(Booking.user_id == actor_user.id)


def _ensure_actor_can_access_booking(db: Session, actor_user: User, booking: Booking) -> None:
    if actor_user.role in ADMIN_ROLES:
        return

    if booking.user_id == actor_user.id:
        return

    if actor_user.role == UserRole.GROUP_LEAD and actor_user.group_id is not None:
        owner = db.query(User).filter(User.id == booking.user_id).first()
        if owner and owner.group_id == actor_user.group_id:
            return

    raise BookingPermissionError("Booking is outside your permission scope")


def _ceil_positive(value: float) -> int:
    if value <= 0:
        return 0
    return int(math.ceil(value))


def _overlap_hours(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
) -> float:
    start = max(start_a, start_b)
    end = min(end_a, end_b)
    if end <= start:
        return 0.0
    return (end - start).total_seconds() / 3600


def _iter_month_windows(start: datetime, end: datetime):
    cursor = datetime(start.year, start.month, 1)
    while cursor < end:
        if cursor.month == 12:
            next_month = datetime(cursor.year + 1, 1, 1)
        else:
            next_month = datetime(cursor.year, cursor.month + 1, 1)

        window_start = max(start, cursor)
        window_end = min(end, next_month)
        yield cursor, next_month, window_start, window_end
        cursor = next_month


def _group_overlap_bookings(db: Session, group_id: int, requested_range: Range) -> list[Booking]:
    return (
        db.query(Booking)
        .join(User, User.id == Booking.user_id)
        .filter(
            User.group_id == group_id,
            Booking.booking_period.op("&&")(requested_range),
            Booking.status.in_(ACTIVE_CAPACITY_STATUSES),
        )
        .all()
    )


def _enforce_group_quotas(
    db: Session,
    actor_user: User,
    *,
    requested_range: Range,
    overlap_window: dict[str, str],
    req_cpu: int,
    req_gpu: int,
    req_ram: int,
    req_vram: int,
) -> None:
    if actor_user.group_id is None:
        return

    group = db.query(Group).filter(Group.id == actor_user.group_id).with_for_update().first()
    if not group:
        return

    overlapping = _group_overlap_bookings(db, actor_user.group_id, requested_range)
    used_cpu = sum(booking.req_cpu for booking in overlapping)
    used_gpu = sum(booking.req_gpu for booking in overlapping)
    used_ram = sum(booking.req_ram for booking in overlapping)
    used_vram = sum(booking.req_vram for booking in overlapping)
    overlapping_ids = [booking.id for booking in overlapping]

    concurrent_rules = [
        ("CPU", group.concurrent_cpu_quota, used_cpu, req_cpu),
        ("GPU", group.concurrent_gpu_quota, used_gpu, req_gpu),
        ("RAM", group.concurrent_ram_quota, used_ram, req_ram),
        ("VRAM", group.concurrent_vram_quota, used_vram, req_vram),
    ]

    for resource, quota, used, requested in concurrent_rules:
        if quota is None:
            continue
        if used + requested <= quota:
            continue

        raise BookingConflictError(
            detail=f"Group concurrent {resource} quota exceeded",
            reason="GROUP_CONCURRENT_QUOTA_EXCEEDED",
            resource=resource,
            shortage=_ceil_positive((used + requested) - quota),
            overlap_window=overlap_window,
            conflicting_booking_ids=overlapping_ids,
            recommended_fixes=[
                "Reduce requested resources",
                "Select a lower-contention window",
                "Request quota increase from administrators",
            ],
        )

    monthly_quotas_enabled = any(
        quota is not None
        for quota in (
            group.monthly_cpu_hours_quota,
            group.monthly_gpu_hours_quota,
            group.monthly_ram_gb_hours_quota,
            group.monthly_vram_gb_hours_quota,
        )
    )
    if not monthly_quotas_enabled:
        return

    for month_start, month_end, requested_start, requested_end in _iter_month_windows(
        requested_range.lower,
        requested_range.upper,
    ):
        requested_hours = _overlap_hours(requested_start, requested_end, month_start, month_end)
        if requested_hours <= 0:
            continue

        month_range = Range(month_start, month_end)
        month_bookings = _group_overlap_bookings(db, actor_user.group_id, month_range)
        month_booking_ids = [booking.id for booking in month_bookings]

        existing_cpu_hours = 0.0
        existing_gpu_hours = 0.0
        existing_ram_hours = 0.0
        existing_vram_hours = 0.0

        for booking in month_bookings:
            period = booking.booking_period
            if not period or period.lower is None or period.upper is None:
                continue

            overlap = _overlap_hours(period.lower, period.upper, month_start, month_end)
            if overlap <= 0:
                continue

            existing_cpu_hours += overlap * booking.req_cpu
            existing_gpu_hours += overlap * booking.req_gpu
            existing_ram_hours += overlap * booking.req_ram
            existing_vram_hours += overlap * booking.req_vram

        requested_cpu_hours = requested_hours * req_cpu
        requested_gpu_hours = requested_hours * req_gpu
        requested_ram_hours = requested_hours * req_ram
        requested_vram_hours = requested_hours * req_vram

        month_label = month_start.strftime("%Y-%m")
        monthly_rules = [
            (
                "CPU",
                group.monthly_cpu_hours_quota,
                existing_cpu_hours,
                requested_cpu_hours,
            ),
            (
                "GPU",
                group.monthly_gpu_hours_quota,
                existing_gpu_hours,
                requested_gpu_hours,
            ),
            (
                "RAM",
                group.monthly_ram_gb_hours_quota,
                existing_ram_hours,
                requested_ram_hours,
            ),
            (
                "VRAM",
                group.monthly_vram_gb_hours_quota,
                existing_vram_hours,
                requested_vram_hours,
            ),
        ]

        for resource, quota, existing_value, requested_value in monthly_rules:
            if quota is None:
                continue
            after = existing_value + requested_value
            if after <= quota:
                continue

            raise BookingConflictError(
                detail=f"Group monthly {resource} quota exceeded for {month_label}",
                reason="GROUP_MONTHLY_QUOTA_EXCEEDED",
                resource=resource,
                shortage=_ceil_positive(after - quota),
                overlap_window=overlap_window,
                conflicting_booking_ids=month_booking_ids,
                recommended_fixes=[
                    "Shorten booking duration",
                    "Request lower resource allocation",
                    "Request quota increase from administrators",
                ],
            )


def list_bookings(
    db: Session,
    actor_user: User,
    *,
    system_id: int | None = None,
    user_id: int | None = None,
    status: str | None = None,
    academic_category: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> list[dict]:
    query = db.query(Booking)
    query = _scope_query_for_actor(query, actor_user)

    if system_id is not None:
        query = query.filter(Booking.system_id == system_id)

    if user_id is not None:
        if actor_user.role in ADMIN_ROLES:
            query = query.filter(Booking.user_id == user_id)
        elif actor_user.role == UserRole.GROUP_LEAD:
            scoped_user = db.query(User).filter(User.id == user_id).first()
            if not scoped_user or scoped_user.group_id != actor_user.group_id:
                raise BookingPermissionError("Cannot filter bookings for users outside your group")
            query = query.filter(Booking.user_id == user_id)
        elif user_id != actor_user.id:
            raise BookingPermissionError("Cannot filter bookings for another user")
        else:
            query = query.filter(Booking.user_id == user_id)

    if status:
        try:
            parsed_status = BookingStatus(status.upper())
        except ValueError as exc:
            raise ValueError(f"Unsupported booking status filter: {status}") from exc

        query = query.filter(Booking.status == parsed_status)

    if academic_category:
        query = query.filter(Booking.academic_category == academic_category)

    if start_time and end_time:
        normalized_start, normalized_end = _normalize_window(start_time, end_time)
        requested_range = Range(normalized_start, normalized_end)
        query = query.filter(Booking.booking_period.op("&&")(requested_range))
    elif start_time:
        query = query.filter(func.upper(Booking.booking_period) > _to_utc_naive(start_time))
    elif end_time:
        query = query.filter(func.lower(Booking.booking_period) < _to_utc_naive(end_time))

    bookings = query.order_by(func.lower(Booking.booking_period).asc(), Booking.id.asc()).all()
    return [_serialize_booking(booking) for booking in bookings]


def get_booking(db: Session, booking_id: int, actor_user: User) -> dict:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()

    if not booking:
        raise BookingNotFoundError(f"Booking {booking_id} not found")

    _ensure_actor_can_access_booking(db, actor_user, booking)
    return _serialize_booking(booking)


def create_booking(db: Session, data, actor_user: User):
    normalized_start, normalized_end = _normalize_window(data.start_time, data.end_time)
    requested_range = Range(normalized_start, normalized_end)
    overlap_window = _serialize_overlap_window(normalized_start, normalized_end)

    try:
        access_type = AccessType(data.access_type)
    except ValueError as exc:
        raise ValueError(f"Unsupported access type: {data.access_type}") from exc

    try:
        system = (
            db.query(ComputeSystem)
            .filter(ComputeSystem.id == data.system_id)
            .with_for_update()
            .first()
        )

        if not system:
            raise ValueError("Compute system not found")

        _enforce_group_quotas(
            db,
            actor_user,
            requested_range=requested_range,
            overlap_window=overlap_window,
            req_cpu=data.req_cpu,
            req_gpu=data.req_gpu,
            req_ram=data.req_ram,
            req_vram=data.req_vram,
        )

        overlapping = (
            db.query(Booking)
            .filter(
                Booking.system_id == data.system_id,
                Booking.booking_period.op("&&")(requested_range),
                Booking.status.in_(ACTIVE_CAPACITY_STATUSES),
            )
            .all()
        )

        used_cpu = sum(booking.req_cpu for booking in overlapping)
        used_gpu = sum(booking.req_gpu for booking in overlapping)
        used_ram = sum(booking.req_ram for booking in overlapping)
        used_vram = sum(booking.req_vram for booking in overlapping)
        overlapping_ids = [booking.id for booking in overlapping]

        if used_cpu + data.req_cpu > system.cpu_cores:
            shortage = used_cpu + data.req_cpu - system.cpu_cores
            raise BookingConflictError(
                detail="CPU capacity exceeded",
                reason="CAPACITY_EXCEEDED",
                resource="CPU",
                shortage=shortage,
                overlap_window=overlap_window,
                conflicting_booking_ids=overlapping_ids,
                recommended_fixes=[
                    "Lower requested CPU cores",
                    "Pick another time window",
                    "Choose a larger compute system",
                ],
            )

        if used_gpu + data.req_gpu > system.gpu_units:
            if access_type == AccessType.FOREGROUND:
                freed_gpu, preempted_ids = preempt_background_jobs(
                    db,
                    data.system_id,
                    data.req_gpu,
                    requested_range,
                )

                if used_gpu - freed_gpu + data.req_gpu > system.gpu_units:
                    shortage = used_gpu - freed_gpu + data.req_gpu - system.gpu_units
                    raise BookingConflictError(
                        detail="Insufficient GPU even after preemption",
                        reason="PREEMPTION_INSUFFICIENT",
                        resource="GPU",
                        shortage=shortage,
                        overlap_window=overlap_window,
                        conflicting_booking_ids=preempted_ids,
                        recommended_fixes=[
                            "Request fewer GPUs",
                            "Choose a larger GPU cluster",
                            "Schedule during lower contention",
                        ],
                    )

            else:
                shortage = used_gpu + data.req_gpu - system.gpu_units
                raise BookingConflictError(
                    detail="GPU capacity exceeded",
                    reason="CAPACITY_EXCEEDED",
                    resource="GPU",
                    shortage=shortage,
                    overlap_window=overlap_window,
                    conflicting_booking_ids=overlapping_ids,
                    recommended_fixes=[
                        "Switch to FOREGROUND only if policy permits",
                        "Request fewer GPUs",
                        "Move to another system/time window",
                    ],
                )

        if used_ram + data.req_ram > system.ram_gb:
            shortage = used_ram + data.req_ram - system.ram_gb
            raise BookingConflictError(
                detail="RAM capacity exceeded",
                reason="CAPACITY_EXCEEDED",
                resource="RAM",
                shortage=shortage,
                overlap_window=overlap_window,
                conflicting_booking_ids=overlapping_ids,
                recommended_fixes=[
                    "Lower RAM requirement",
                    "Split job into smaller runs",
                ],
            )

        if used_vram + data.req_vram > system.vram_gb:
            shortage = used_vram + data.req_vram - system.vram_gb
            raise BookingConflictError(
                detail="VRAM capacity exceeded",
                reason="CAPACITY_EXCEEDED",
                resource="VRAM",
                shortage=shortage,
                overlap_window=overlap_window,
                conflicting_booking_ids=overlapping_ids,
                recommended_fixes=[
                    "Reduce model memory footprint",
                    "Pick a system with larger VRAM",
                ],
            )

        booking = Booking(
            system_id=data.system_id,
            user_id=actor_user.id,
            booking_period=requested_range,
            req_cpu=data.req_cpu,
            req_gpu=data.req_gpu,
            req_ram=data.req_ram,
            req_vram=data.req_vram,
            access_type=access_type,
            academic_category=data.academic_category,
            project_title=data.project_title,
            expected_deliverable=data.expected_deliverable,
            objective=data.objective,
            status=BookingStatus.CONFIRMED,
        )

        db.add(booking)
        db.flush()
        db.add(
            AuditLog(
                table_name="bookings",
                record_id=booking.id,
                action="CREATED",
                timestamp=datetime.utcnow(),
                user_id=actor_user.id,
            )
        )
        db.commit()
        db.refresh(booking)

        return booking
    except Exception:
        db.rollback()
        raise


def check_availability(db: Session, system_id, start_time, end_time):
    normalized_start, normalized_end = _normalize_window(start_time, end_time)
    requested_range = Range(normalized_start, normalized_end)

    system = db.query(ComputeSystem).filter(ComputeSystem.id == system_id).first()

    if not system:
        raise ValueError("Compute system not found")

    bookings = (
        db.query(Booking)
        .filter(
            Booking.system_id == system_id,
            Booking.booking_period.op("&&")(requested_range),
            Booking.status.in_(ACTIVE_CAPACITY_STATUSES),
        )
        .all()
    )

    used_cpu = sum(booking.req_cpu for booking in bookings)
    used_gpu = sum(booking.req_gpu for booking in bookings)
    used_ram = sum(booking.req_ram for booking in bookings)
    used_vram = sum(booking.req_vram for booking in bookings)

    return {
        "cpu_available": system.cpu_cores - used_cpu,
        "gpu_available": system.gpu_units - used_gpu,
        "ram_available": system.ram_gb - used_ram,
        "vram_available": system.vram_gb - used_vram,
    }


def preempt_background_jobs(db: Session, system_id, required_gpu, time_range):
    overlapping = (
        db.query(Booking)
        .filter(
            Booking.system_id == system_id,
            Booking.booking_period.op("&&")(time_range),
            Booking.status == BookingStatus.CONFIRMED,
            Booking.access_type == AccessType.BACKGROUND,
        )
        .order_by(Booking.req_gpu.desc(), Booking.id.asc())
        .all()
    )

    freed_gpu = 0
    preempted_ids: list[int] = []

    for job in overlapping:
        job.status = BookingStatus.PREEMPTED
        freed_gpu += job.req_gpu
        preempted_ids.append(job.id)

        db.add(
            AuditLog(
                table_name="bookings",
                record_id=job.id,
                action="PREEMPTED",
                timestamp=datetime.utcnow(),
                user_id=job.user_id,
            )
        )

        if freed_gpu >= required_gpu:
            break

    return freed_gpu, preempted_ids


def cancel_booking(db: Session, booking_id: int, actor_user: User):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()

    if not booking:
        raise BookingNotFoundError("Booking not found")

    owns_booking = booking.user_id == actor_user.id
    if not (actor_user.role in ADMIN_ROLES or owns_booking):
        raise BookingPermissionError("Only owner or admin can cancel this booking")

    allowed_statuses = {BookingStatus.REQUESTED, BookingStatus.CONFIRMED}
    current_status = booking.status
    if current_status not in allowed_statuses:
        raise BookingConflictError(
            detail=f"Cannot cancel booking in status {current_status.value if current_status else 'UNKNOWN'}",
            reason="INVALID_TRANSITION",
            conflicting_booking_ids=[booking.id],
            recommended_fixes=[
                "Cancel only REQUESTED or CONFIRMED bookings",
                "For PREEMPTED/COMPLETED bookings, create a new request",
            ],
        )

    booking.status = BookingStatus.CANCELLED
    db.add(
        AuditLog(
            table_name="bookings",
            record_id=booking.id,
            action="CANCELLED",
            timestamp=datetime.utcnow(),
            user_id=actor_user.id,
        )
    )

    db.commit()
    db.refresh(booking)
    return _serialize_booking(booking)
