from datetime import datetime, timezone

from sqlalchemy.orm import Session

from crags.modules.audit.models import AuditAction, AuditLog
from crags.modules.iam.models import User
from crags.modules.resources.models import ComputeSystem, SystemStatus


def _write_audit(db: Session, action: AuditAction, system_id: int, user_id: int) -> None:
    db.add(AuditLog(
        table_name="compute_systems",
        record_id=system_id,
        action=action,
        timestamp=datetime.now(timezone.utc),
        user_id=user_id,
    ))


def list_systems(db: Session, status: SystemStatus | None = None) -> list[ComputeSystem]:
    q = db.query(ComputeSystem)
    if status is not None:
        q = q.filter(ComputeSystem.status == status)
    return q.all()


def get_system(db: Session, system_id: int) -> ComputeSystem:
    system = db.query(ComputeSystem).filter(ComputeSystem.id == system_id).first()
    if not system:
        raise ValueError(f"System {system_id} not found")
    return system


def create_system(db: Session, data, actor: User) -> ComputeSystem:
    system = ComputeSystem(**data.model_dump())
    db.add(system)
    db.flush()
    _write_audit(db, AuditAction.SYSTEM_CREATED, system.id, actor.id)
    db.commit()
    db.refresh(system)
    return system


def update_system(db: Session, system_id: int, data, actor: User) -> ComputeSystem:
    system = (
        db.query(ComputeSystem)
        .with_for_update()
        .filter(ComputeSystem.id == system_id)
        .first()
    )
    if not system:
        raise ValueError(f"System {system_id} not found")

    updates = data.model_dump(exclude_unset=True)

    # Reject capacity reductions that would violate active bookings.
    capacity_fields = {"cpu_cores", "gpu_units", "ram_gb", "vram_gb"}
    if capacity_fields & updates.keys():
        from crags.modules.scheduling.models import Booking, BookingStatus
        active = db.query(Booking).filter(
            Booking.system_id == system_id,
            Booking.status.in_([BookingStatus.REQUESTED, BookingStatus.CONFIRMED]),
        ).all()
        if active:
            check = {
                "cpu_cores": max(b.req_cpu for b in active),
                "gpu_units": max(b.req_gpu for b in active),
                "ram_gb":    max(b.req_ram for b in active),
                "vram_gb":   max(b.req_vram for b in active),
            }
            for field, min_val in check.items():
                new_val = updates.get(field, getattr(system, field))
                if new_val < min_val:
                    raise ValueError(
                        f"Cannot reduce {field} to {new_val} — "
                        f"active bookings require at least {min_val}"
                    )

    for field, value in updates.items():
        setattr(system, field, value)

    _write_audit(db, AuditAction.SYSTEM_UPDATED, system.id, actor.id)
    db.commit()
    db.refresh(system)
    return system


def delete_system(db: Session, system_id: int, actor: User) -> ComputeSystem:
    """Soft-delete: sets status to OFFLINE."""
    system = db.query(ComputeSystem).filter(ComputeSystem.id == system_id).first()
    if not system:
        raise ValueError(f"System {system_id} not found")

    system.status = SystemStatus.OFFLINE
    _write_audit(db, AuditAction.SYSTEM_DELETED, system.id, actor.id)
    db.commit()
    db.refresh(system)
    return system
