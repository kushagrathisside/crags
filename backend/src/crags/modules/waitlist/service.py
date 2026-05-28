"""
Waitlist / Queue Service
========================
When a user cannot get capacity immediately, they can join the waitlist.
The reconciler calls `promote_eligible` after each booking completes or is
cancelled; eligible entries are converted to CONFIRMED bookings and the user
is notified.

Priority ordering: higher priority score wins; tie-break by created_at (FIFO).
Group leads receive +10 priority bonus via the endpoint.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.audit.models import AuditAction
from crags.modules.audit.service import emit_audit
from crags.modules.iam.models import User
from crags.modules.resources.models import ComputeSystem
from crags.modules.scheduling.models import Booking, BookingStatus
from crags.modules.waitlist.models import WaitlistEntry
from crags.modules.waitlist.schemas import WaitlistJoin

ACTIVE_CAPACITY_STATUSES = [BookingStatus.REQUESTED, BookingStatus.CONFIRMED]


def join_waitlist(db: Session, payload: WaitlistJoin, actor_user: User) -> WaitlistEntry:
    system = db.query(ComputeSystem).filter(ComputeSystem.id == payload.system_id).first()
    if not system:
        raise ValueError("Compute system not found")
    # Prevent duplicate WAITING entries for the same system
    existing = db.query(WaitlistEntry).filter(
        WaitlistEntry.user_id == actor_user.id,
        WaitlistEntry.system_id == payload.system_id,
        WaitlistEntry.status == "WAITING",
    ).first()
    if existing:
        raise ValueError("You already have an active waitlist entry for this system")

    from crags.modules.iam.models import UserRole
    priority = 10 if actor_user.role in (UserRole.GROUP_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN) else 0

    entry = WaitlistEntry(
        user_id=actor_user.id,
        system_id=payload.system_id,
        req_cpu=payload.req_cpu,
        req_gpu=payload.req_gpu,
        req_ram=payload.req_ram,
        req_vram=payload.req_vram,
        duration_hours=payload.duration_hours,
        access_type=payload.access_type,
        academic_category=payload.academic_category,
        project_title=payload.project_title,
        status="WAITING",
        priority=priority,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    emit_audit(db, AuditAction.WAITLIST_JOINED, entry.id, actor_user.id, "waitlist_entries")
    return entry


def list_waitlist(db: Session, system_id: Optional[int] = None, actor_user: Optional[User] = None) -> list[WaitlistEntry]:
    q = db.query(WaitlistEntry)
    if system_id:
        q = q.filter(WaitlistEntry.system_id == system_id)
    if actor_user:
        from crags.modules.iam.models import UserRole
        if actor_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            q = q.filter(WaitlistEntry.user_id == actor_user.id)
    return q.order_by(WaitlistEntry.priority.desc(), WaitlistEntry.created_at.asc()).all()


def cancel_waitlist_entry(db: Session, entry_id: int, actor_user: User) -> bool:
    entry = db.query(WaitlistEntry).filter(WaitlistEntry.id == entry_id).first()
    if not entry:
        return False
    from crags.modules.iam.models import UserRole
    if entry.user_id != actor_user.id and actor_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise PermissionError("Not authorized to cancel this waitlist entry")
    entry.status = "CANCELLED"
    db.commit()
    emit_audit(db, AuditAction.WAITLIST_CANCELLED, entry.id, actor_user.id, "waitlist_entries")
    return True


def promote_eligible(db: Session) -> int:
    """Try to promote WAITING entries to bookings when capacity is freed. Returns count promoted."""
    from psycopg.types.range import Range

    promoted = 0
    waiting = (
        db.query(WaitlistEntry)
        .filter(WaitlistEntry.status == "WAITING")
        .order_by(WaitlistEntry.priority.desc(), WaitlistEntry.created_at.asc())
        .all()
    )

    for entry in waiting:
        system = db.query(ComputeSystem).filter(ComputeSystem.id == entry.system_id).first()
        if not system:
            continue

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        duration = timedelta(hours=entry.duration_hours)
        start = now + timedelta(minutes=5)
        end = start + duration
        slot = Range(start, end)

        overlapping = (
            db.query(Booking)
            .filter(
                Booking.system_id == entry.system_id,
                Booking.booking_period.op("&&")(slot),
                Booking.status.in_(ACTIVE_CAPACITY_STATUSES),
            ).all()
        )
        used_cpu = sum(b.req_cpu for b in overlapping)
        used_gpu = sum(b.req_gpu for b in overlapping)
        used_ram = sum(b.req_ram for b in overlapping)
        used_vram = sum(b.req_vram for b in overlapping)

        if (
            used_cpu + entry.req_cpu <= (system.cpu_cores or 0)
            and used_gpu + entry.req_gpu <= (system.gpu_units or 0)
            and used_ram + entry.req_ram <= (system.ram_gb or 0)
            and used_vram + entry.req_vram <= (system.vram_gb or 0)
        ):
            from crags.modules.scheduling.models import AccessType
            booking = Booking(
                system_id=entry.system_id,
                user_id=entry.user_id,
                booking_period=slot,
                req_cpu=entry.req_cpu,
                req_gpu=entry.req_gpu,
                req_ram=entry.req_ram,
                req_vram=entry.req_vram,
                access_type=AccessType(entry.access_type),
                academic_category=entry.academic_category,
                project_title=entry.project_title,
                expected_deliverable="",
                objective="",
                status=BookingStatus.CONFIRMED,
            )
            db.add(booking)
            entry.status = "PROMOTED"
            entry.notified_at = datetime.now(timezone.utc)
            db.flush()
            emit_audit(db, AuditAction.WAITLIST_PROMOTED, entry.id, entry.user_id, "waitlist_entries")
            promoted += 1

    db.commit()
    return promoted
