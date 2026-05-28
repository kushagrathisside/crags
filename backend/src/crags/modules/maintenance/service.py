"""
Maintenance Windows Service
===========================
Manages scheduled maintenance windows for compute systems. When a window
starts, the reconciler transitions the system to MAINTENANCE and auto-cancels
any CONFIRMED bookings that overlap the window. When it ends, the system
returns to ACTIVE.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.audit.models import AuditAction
from crags.modules.audit.service import emit_audit
from crags.modules.maintenance.models import MaintenanceWindow
from crags.modules.maintenance.schemas import MaintenanceWindowCreate
from crags.modules.resources.models import ComputeSystem, SystemStatus
from crags.modules.scheduling.models import Booking, BookingStatus


def create_maintenance_window(
    db: Session,
    payload: MaintenanceWindowCreate,
    actor_user_id: Optional[int] = None,
) -> MaintenanceWindow:
    system = db.query(ComputeSystem).filter(ComputeSystem.id == payload.system_id).first()
    if not system:
        raise ValueError("Compute system not found")
    window = MaintenanceWindow(
        system_id=payload.system_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        reason=payload.reason,
        created_by=actor_user_id,
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    emit_audit(db, AuditAction.MAINTENANCE_CREATED, window.id, actor_user_id, "maintenance_windows")
    return window


def list_maintenance_windows(db: Session, system_id: Optional[int] = None) -> list[MaintenanceWindow]:
    q = db.query(MaintenanceWindow)
    if system_id:
        q = q.filter(MaintenanceWindow.system_id == system_id)
    return q.order_by(MaintenanceWindow.start_time.asc()).all()


def delete_maintenance_window(
    db: Session,
    window_id: int,
    actor_user_id: Optional[int] = None,
) -> bool:
    window = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == window_id).first()
    if not window:
        return False
    db.delete(window)
    db.commit()
    emit_audit(db, AuditAction.MAINTENANCE_DELETED, window_id, actor_user_id, "maintenance_windows")
    return True


def apply_maintenance_transitions(db: Session) -> None:
    """Called by the reconciler: activate/deactivate windows and cancel overlapping bookings."""
    now = datetime.now(timezone.utc)

    # Systems whose windows are currently active
    active_windows = (
        db.query(MaintenanceWindow)
        .filter(MaintenanceWindow.start_time <= now, MaintenanceWindow.end_time > now)
        .all()
    )
    active_system_ids = {w.system_id for w in active_windows}

    # Put active-window systems in MAINTENANCE
    for system in db.query(ComputeSystem).filter(ComputeSystem.id.in_(active_system_ids), ComputeSystem.status == SystemStatus.ACTIVE).all():
        system.status = SystemStatus.MAINTENANCE
        # Cancel overlapping bookings
        for booking in db.query(Booking).filter(
            Booking.system_id == system.id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.REQUESTED]),
        ).all():
            booking.status = BookingStatus.CANCELLED

    # Return systems to ACTIVE when no active windows remain
    all_maintained_ids = {
        row[0] for row in db.query(ComputeSystem.id).filter(ComputeSystem.status == SystemStatus.MAINTENANCE).all()
    }
    to_restore = all_maintained_ids - active_system_ids
    if to_restore:
        db.query(ComputeSystem).filter(ComputeSystem.id.in_(to_restore)).update(
            {"status": SystemStatus.ACTIVE}, synchronize_session=False
        )

    db.commit()
