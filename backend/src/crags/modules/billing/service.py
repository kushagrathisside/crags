"""
Cost / Billing Service
======================
Associates per-resource hour rates with compute systems and calculates
the estimated cost of completed/active bookings.
"""
from __future__ import annotations

from datetime import timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.billing.models import SystemCost
from crags.modules.billing.schemas import BookingCost, SystemCostUpsert, UserCostSummary
from crags.modules.iam.models import User
from crags.modules.resources.models import ComputeSystem
from crags.modules.scheduling.models import Booking


def upsert_system_cost(db: Session, system_id: int, payload: SystemCostUpsert) -> SystemCost:
    system = db.query(ComputeSystem).filter(ComputeSystem.id == system_id).first()
    if not system:
        raise ValueError("Compute system not found")
    cost = db.query(SystemCost).filter(SystemCost.system_id == system_id).first()
    if cost:
        for k, v in payload.model_dump().items():
            setattr(cost, k, v)
    else:
        cost = SystemCost(system_id=system_id, **payload.model_dump())
        db.add(cost)
    db.commit()
    db.refresh(cost)
    return cost


def get_system_cost(db: Session, system_id: int) -> Optional[SystemCost]:
    return db.query(SystemCost).filter(SystemCost.system_id == system_id).first()


def list_system_costs(db: Session) -> list[SystemCost]:
    return db.query(SystemCost).order_by(SystemCost.system_id).all()


def _calculate_booking_cost(booking: Booking, cost: Optional[SystemCost]) -> Optional[BookingCost]:
    if not cost:
        return None
    period = booking.booking_period
    if not period or period.lower is None or period.upper is None:
        return None
    duration_hours = (period.upper - period.lower).total_seconds() / 3600
    cpu_cost = Decimal(str(duration_hours)) * Decimal(booking.req_cpu) * cost.cpu_core_hour_rate
    gpu_cost = Decimal(str(duration_hours)) * Decimal(booking.req_gpu) * cost.gpu_hour_rate
    ram_cost = Decimal(str(duration_hours)) * Decimal(booking.req_ram) * cost.ram_gb_hour_rate
    vram_cost = Decimal(str(duration_hours)) * Decimal(booking.req_vram) * cost.vram_gb_hour_rate
    total = cpu_cost + gpu_cost + ram_cost + vram_cost
    return BookingCost(
        booking_id=booking.id,
        system_id=booking.system_id,
        duration_hours=round(duration_hours, 2),
        cpu_cost=cpu_cost.quantize(Decimal("0.0001")),
        gpu_cost=gpu_cost.quantize(Decimal("0.0001")),
        ram_cost=ram_cost.quantize(Decimal("0.0001")),
        vram_cost=vram_cost.quantize(Decimal("0.0001")),
        total_cost=total.quantize(Decimal("0.0001")),
        currency=cost.currency,
    )


def get_booking_cost(db: Session, booking_id: int) -> Optional[BookingCost]:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return None
    cost = get_system_cost(db, booking.system_id)
    return _calculate_booking_cost(booking, cost)


def get_user_cost_summary(db: Session, from_time=None, to_time=None) -> list[UserCostSummary]:
    from psycopg.types.range import Range
    from datetime import timezone

    q = db.query(Booking)
    if from_time and to_time:
        from_naive = from_time.astimezone(timezone.utc).replace(tzinfo=None)
        to_naive = to_time.astimezone(timezone.utc).replace(tzinfo=None)
        q = q.filter(Booking.booking_period.op("&&")(Range(from_naive, to_naive)))

    bookings = q.all()
    costs_by_system = {c.system_id: c for c in db.query(SystemCost).all()}
    users_by_id = {u.id: u for u in db.query(User).all()}

    user_totals: dict[int, dict] = {}
    for b in bookings:
        cost = costs_by_system.get(b.system_id)
        bc = _calculate_booking_cost(b, cost)
        if bc is None:
            continue
        uid = b.user_id or 0
        if uid not in user_totals:
            user = users_by_id.get(uid)
            user_totals[uid] = {"user_id": uid, "username": user.username if user else None, "total_cost": Decimal("0"), "currency": bc.currency, "booking_count": 0}
        user_totals[uid]["total_cost"] += bc.total_cost
        user_totals[uid]["booking_count"] += 1

    return [UserCostSummary(**v) for v in user_totals.values()]
