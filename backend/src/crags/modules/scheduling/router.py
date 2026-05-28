from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.scheduling.schemas import (
    BookingApproveRequest,
    BookingConflictResponse,
    BookingCreate,
    BookingExtendRequest,
    BookingRead,
    BookingRejectRequest,
    BookingResizeRequest,
)
from crags.modules.scheduling.service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingPermissionError,
    approve_booking,
    cancel_booking,
    check_availability,
    create_booking,
    extend_booking,
    get_booking,
    list_bookings,
    reject_booking,
    resize_booking,
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
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
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
            limit=limit,
            offset=offset,
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
        msg = str(exc)
        if "not found" in msg:
            status_code = 404
        elif "not available for booking" in msg:
            status_code = 409
        elif "must be in the future" in msg or "must be strictly after" in msg:
            status_code = 422
        else:
            status_code = 400
        raise HTTPException(status_code=status_code, detail=msg) from exc


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


@router.patch("/{booking_id}/approve", response_model=BookingRead)
def approve_existing_booking(
    booking_id: int,
    _: BookingApproveRequest = BookingApproveRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return approve_booking(db, booking_id, current_user)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)


@router.patch("/{booking_id}/reject", response_model=BookingRead)
def reject_existing_booking(
    booking_id: int,
    body: BookingRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return reject_booking(db, booking_id, current_user, body.reason)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)


@router.patch("/{booking_id}/extend", response_model=BookingRead)
def extend_existing_booking(
    booking_id: int,
    body: BookingExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return extend_booking(db, booking_id, current_user, body.new_end_time)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{booking_id}/resize", response_model=BookingRead)
def resize_existing_booking(
    booking_id: int,
    body: BookingResizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return resize_booking(
            db, booking_id, current_user,
            req_cpu=body.req_cpu, req_gpu=body.req_gpu,
            req_ram=body.req_ram, req_vram=body.req_vram,
        )
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except BookingConflictError as exc:
        payload = BookingConflictResponse(**exc.to_response()).model_dump()
        return JSONResponse(status_code=409, content=payload)
