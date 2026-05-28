"""Current resources coverage for system CRUD and capacity guards."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from psycopg.types.range import Range

from crags.modules.audit.models import AuditAction, AuditLog
from crags.modules.resources.models import ComputeSystem, SystemStatus, SystemType
from crags.modules.resources.schemas import SystemCreate, SystemUpdate
from crags.modules.resources.service import create_system, delete_system, list_systems, update_system
from crags.modules.scheduling.models import AccessType, Booking, BookingStatus

pytestmark = pytest.mark.unit


def test_list_systems_can_filter_by_status(db_session, compute_system, maintenance_system):
    active_systems = list_systems(db_session, status=SystemStatus.ACTIVE)
    assert [system.id for system in active_systems] == [compute_system.id]


def test_create_system_writes_an_audit_record(db_session, admin_user):
    created = create_system(
        db_session,
        SystemCreate(
            name="gpu-node-b",
            system_type=SystemType.GPU,
            cpu_cores=32,
            ram_gb=128,
            gpu_units=4,
            vram_gb=80,
            status=SystemStatus.ACTIVE,
        ),
        admin_user,
    )

    audit_rows = (
        db_session.query(AuditLog)
        .filter(AuditLog.record_id == created.id, AuditLog.action == AuditAction.SYSTEM_CREATED)
        .all()
    )
    assert created.name == "gpu-node-b"
    assert len(audit_rows) == 1


def test_update_system_rejects_capacity_reduction_below_active_booking(db_session, admin_user, compute_system, member_user):
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=2)
    end = start + timedelta(hours=2)
    db_session.add(
        Booking(
            system_id=compute_system.id,
            user_id=member_user.id,
            booking_period=Range(start.replace(tzinfo=None), end.replace(tzinfo=None)),
            req_cpu=24,
            req_gpu=2,
            req_ram=64,
            req_vram=32,
            access_type=AccessType.FOREGROUND,
            academic_category="research",
            project_title="Capacity Guard",
            expected_deliverable="artifact",
            objective="Block unsafe resize",
            status=BookingStatus.CONFIRMED,
        )
    )
    db_session.commit()

    with pytest.raises(ValueError, match="Cannot reduce cpu_cores"):
        update_system(
            db_session,
            compute_system.id,
            SystemUpdate(cpu_cores=16),
            admin_user,
        )


def test_delete_system_is_a_soft_delete(db_session, admin_user, compute_system):
    deleted = delete_system(db_session, compute_system.id, admin_user)
    assert deleted.status == SystemStatus.OFFLINE


def test_update_system_can_change_status_and_name(db_session, admin_user, compute_system):
    updated = update_system(
        db_session,
        compute_system.id,
        SystemUpdate(name="gpu-node-renamed", status=SystemStatus.MAINTENANCE),
        admin_user,
    )
    assert updated.name == "gpu-node-renamed"
    assert updated.status == SystemStatus.MAINTENANCE
