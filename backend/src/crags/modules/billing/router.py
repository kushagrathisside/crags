from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from crags.core.cache import KEY_BILLING_COSTS, TTL_BILLING_COSTS, get_cache
from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user, require_admin
from crags.modules.iam.models import User
from crags.modules.billing import service
from crags.modules.billing.schemas import BookingCost, SystemCostOut, SystemCostUpsert, UserCostSummary

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/costs", response_model=list[SystemCostOut])
def list_costs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    hit = get_cache().get(KEY_BILLING_COSTS)
    if hit is not None:
        return hit
    result = service.list_system_costs(db)
    get_cache().set(KEY_BILLING_COSTS, jsonable_encoder(result), ttl=TTL_BILLING_COSTS)
    return result


@router.put("/costs/{system_id}", response_model=SystemCostOut)
def upsert_cost(
    system_id: int,
    payload: SystemCostUpsert,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        result = service.upsert_system_cost(db, system_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    get_cache().delete(KEY_BILLING_COSTS)
    return result


@router.get("/bookings/{booking_id}/cost", response_model=BookingCost)
def booking_cost(booking_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    bc = service.get_booking_cost(db, booking_id)
    if not bc:
        raise HTTPException(status_code=404, detail="Booking not found or no cost rates defined")
    return bc


@router.get("/summary", response_model=list[UserCostSummary])
def cost_summary(
    from_time: Optional[datetime] = Query(None),
    to_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return service.get_user_cost_summary(db, from_time=from_time, to_time=to_time)
