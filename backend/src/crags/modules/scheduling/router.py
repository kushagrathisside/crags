from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from crags.db.session import get_db
from crags.modules.scheduling.service import create_booking, check_availability
from crags.modules.scheduling.schemas import BookingCreate

router = APIRouter(
    prefix="/api/v1/bookings",
    tags=["bookings"]
)


@router.get("/systems/{system_id}/availability")
def availability(
    system_id: int,
    start_time: datetime,
    end_time: datetime,
    db: Session = Depends(get_db)
):
    return check_availability(db, system_id, start_time, end_time)

@router.post("/")
def create(data: BookingCreate, db: Session = Depends(get_db)):
    try:
        return create_booking(db, data, user_id=1)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.patch("/{booking_id}/cancel")
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):

    booking = db.query(Booking).filter(
        Booking.id == booking_id
    ).first()

    if not booking:
        raise HTTPException(404, "Booking not found")

    booking.status = "CANCELLED"

    db.commit()

    return {"status": "cancelled"}