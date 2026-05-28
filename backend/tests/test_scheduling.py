"""Current scheduling coverage for booking creation and lifecycle flows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from psycopg.types.range import Range
from sqlalchemy.orm import configure_mappers

from crags.modules.policies.schemas import PolicyCreate
from crags.modules.policies.service import create_policy
from crags.modules.scheduling.models import AccessType, Booking, BookingStatus
from crags.modules.scheduling.schemas import BookingCreate
from crags.modules.scheduling.service import (
    BookingConflictError,
    approve_booking,
    cancel_booking,
    check_availability,
    create_booking,
)

pytestmark = pytest.mark.unit


def test_configure_mappers_succeeds():
    configure_mappers()


def test_create_booking_confirms_simple_request(db_session, member_user, compute_system):
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=3)
    end = start + timedelta(hours=2)

    booking = create_booking(
        db_session,
        BookingCreate(
            system_id=compute_system.id,
            start_time=start,
            end_time=end,
            req_cpu=8,
            req_gpu=1,
            req_ram=32,
            req_vram=16,
            access_type="FOREGROUND",
            academic_category="research",
            project_title="Current Suite",
            expected_deliverable="artifact",
            objective="exercise booking creation",
        ),
        member_user,
    )

    assert booking.status == BookingStatus.CONFIRMED
    assert booking.user_id == member_user.id


def test_create_booking_respects_approval_policy(db_session, admin_user, member_user, compute_system, test_group):
    create_policy(
        db_session,
        PolicyCreate(
            name="approval-required",
            group_id=test_group.id,
            approval_required_above_gpu=1,
        ),
        actor_user_id=admin_user.id,
    )

    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=5)
    end = start + timedelta(hours=2)
    booking = create_booking(
        db_session,
        BookingCreate(
            system_id=compute_system.id,
            start_time=start,
            end_time=end,
            req_cpu=8,
            req_gpu=2,
            req_ram=32,
            req_vram=16,
            access_type="FOREGROUND",
            academic_category="research",
            project_title="Needs Approval",
            expected_deliverable="report",
            objective="route through REQUESTED",
        ),
        member_user,
    )

    assert booking.status == BookingStatus.REQUESTED
    approved = approve_booking(db_session, booking.id, admin_user)
    assert approved["status"] == "CONFIRMED"
    assert approved["approved_by"] == admin_user.id


def test_create_booking_rejects_capacity_conflicts(db_session, member_user, compute_system, confirmed_booking):
    start = confirmed_booking.booking_period.lower.replace(tzinfo=timezone.utc)
    end = confirmed_booking.booking_period.upper.replace(tzinfo=timezone.utc)

    with pytest.raises(BookingConflictError, match="CPU capacity exceeded"):
        create_booking(
            db_session,
            BookingCreate(
                system_id=compute_system.id,
                start_time=start,
                end_time=end,
                req_cpu=compute_system.cpu_cores,
                req_gpu=1,
                req_ram=32,
                req_vram=8,
                access_type="FOREGROUND",
                academic_category="research",
                project_title="Overbook CPU",
                expected_deliverable="artifact",
                objective="raise conflict",
            ),
            member_user,
        )


def test_check_availability_subtracts_active_booking(db_session, compute_system, confirmed_booking):
    start = confirmed_booking.booking_period.lower.replace(tzinfo=timezone.utc)
    end = confirmed_booking.booking_period.upper.replace(tzinfo=timezone.utc)
    result = check_availability(db_session, compute_system.id, start, end)

    assert result["cpu_available"] == compute_system.cpu_cores - confirmed_booking.req_cpu
    assert result["gpu_available"] == compute_system.gpu_units - confirmed_booking.req_gpu


def test_cancel_booking_marks_booking_cancelled(db_session, member_user, compute_system):
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=7)
    end = start + timedelta(hours=2)
    booking = Booking(
        system_id=compute_system.id,
        user_id=member_user.id,
        booking_period=Range(start.replace(tzinfo=None), end.replace(tzinfo=None)),
        req_cpu=4,
        req_gpu=1,
        req_ram=16,
        req_vram=8,
        access_type=AccessType.FOREGROUND,
        academic_category="research",
        project_title="Cancel Me",
        expected_deliverable="artifact",
        objective="exercise cancellation",
        status=BookingStatus.CONFIRMED,
    )
    db_session.add(booking)
    db_session.commit()

    cancelled = cancel_booking(db_session, booking.id, member_user)
    assert cancelled["status"] == "CANCELLED"
