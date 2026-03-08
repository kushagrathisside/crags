from sqlalchemy.orm import Session
from datetime import datetime

from crags.modules.scheduling.models import Booking


def reconcile_bookings(db: Session):

    now = datetime.utcnow()

    bookings = db.query(Booking).filter(
        Booking.booking_period.op("<")(now),
        Booking.status == "CONFIRMED"
    ).all()

    for b in bookings:
        b.status = "COMPLETED"

    db.commit()