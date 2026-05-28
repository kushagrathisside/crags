"""
Periodic reconciliation job — runs on every scheduler tick.

Responsibilities
----------------
1. CONFIRMED bookings whose window has ended  →  COMPLETED
2. REQUESTED bookings whose window has ended  →  EXPIRED
3. Prune expired token_blacklist rows
4. Prune audit_logs rows older than AUDIT_RETAIN_DAYS

Both booking queries use SELECT ... FOR UPDATE SKIP LOCKED so the reconciler
never deadlocks against a concurrent booking creation that holds a row lock,
and multiple scheduler instances (e.g. two replicas firing at the same time)
skip rows the other instance already locked rather than blocking.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from crags.core.config import settings
from crags.modules.scheduling.models import Booking, BookingStatus

logger = logging.getLogger(__name__)


def reconcile_bookings(db: Session) -> dict[str, int]:
    now = datetime.now(timezone.utc)

    # --- 1. CONFIRMED → COMPLETED -------------------------------------------
    confirmed_done = (
        db.query(Booking)
        .filter(
            func.upper(Booking.booking_period) < now,
            Booking.status == BookingStatus.CONFIRMED,
        )
        .with_for_update(skip_locked=True)
        .all()
    )
    for b in confirmed_done:
        b.status = BookingStatus.COMPLETED

    # --- 2. REQUESTED → EXPIRED ---------------------------------------------
    requested_expired = (
        db.query(Booking)
        .filter(
            func.upper(Booking.booking_period) < now,
            Booking.status == BookingStatus.REQUESTED,
        )
        .with_for_update(skip_locked=True)
        .all()
    )
    for b in requested_expired:
        b.status = BookingStatus.EXPIRED

    db.commit()

    n_completed = len(confirmed_done)
    n_expired = len(requested_expired)

    # --- 3. Prune expired token blacklist ------------------------------------
    from crags.modules.iam.service import cleanup_expired_blacklist
    n_blacklist = cleanup_expired_blacklist(db)

    # --- 4. Prune old audit logs --------------------------------------------
    from crags.modules.audit.service import cleanup_old_audit_logs
    n_audit = cleanup_old_audit_logs(db, retain_days=settings.AUDIT_RETAIN_DAYS)

    logger.info(
        "reconcile: completed=%d expired=%d blacklist_pruned=%d audit_pruned=%d",
        n_completed, n_expired, n_blacklist, n_audit,
    )

    return {
        "completed": n_completed,
        "expired": n_expired,
        "blacklist_pruned": n_blacklist,
        "audit_pruned": n_audit,
    }
