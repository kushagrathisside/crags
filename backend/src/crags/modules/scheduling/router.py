from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.scheduling.schemas import BookingConflictResponse, BookingCreate, BookingRead
from crags.modules.scheduling.service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingPermissionError,
    cancel_booking,
    check_availability,
    create_booking,
    get_booking,
    list_bookings,
)

router = APIRouter(
    prefix="/api/v1/bookings",
    tags=["bookings"],
)


@router.get("/systems/{system_id}/availability")
def availability(
    system_id: int,
    start_time: datetime,
    end_time: datetime,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        return check_availability(db, system_id, start_time, end_time)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Compute system not found" else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.get("/", response_model=list[BookingRead])
def list_all_bookings(
    system_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    academic_category: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_bookings(
            db,
            current_user,
            system_id=system_id,
            user_id=user_id,
            status=status,
            academic_category=academic_category,
            start_time=start_time,
            end_time=end_time,
        )
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking_by_id(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return get_booking(db, booking_id, current_user)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/")
def create(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_booking(db, data, current_user)
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Compute system not found" else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.patch("/{booking_id}/cancel")
def cancel_existing_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return cancel_booking(db, booking_id, current_user)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)
