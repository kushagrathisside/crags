"""Pytest configuration and shared fixtures for the current CRAGS backend."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from psycopg.types.range import Range
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

# The app settings module reads DATABASE_URL at import time, so set a safe
# default before importing CRAGS modules.
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv(
        "CRAGS_TEST_DATABASE_URL",
        "postgresql+psycopg://crags:crags@127.0.0.1:5433/crags",
    ),
)

from crags.core.cache import KEY_BILLING_COSTS, KEY_POLICIES, KEY_SYSTEMS, get_cache
from crags.core.security import create_access_token, hash_password
from crags.db.base import Base
from crags.db.session import get_db
from crags.main import app
from crags.modules.analytics import router as analytics_router  # noqa: F401
from crags.modules.audit import router as audit_router  # noqa: F401
from crags.modules.billing import router as billing_router  # noqa: F401
from crags.modules.health import router as health_router  # noqa: F401
from crags.modules.iam import router as iam_router  # noqa: F401
from crags.modules.iam.models import Group, User, UserRole
from crags.modules.maintenance import router as maintenance_router  # noqa: F401
from crags.modules.policies import router as policies_router  # noqa: F401
from crags.modules.resources.models import ComputeSystem, SystemStatus, SystemType
from crags.modules.scheduling.models import AccessType, Booking, BookingStatus
from crags.modules.templates import router as templates_router  # noqa: F401
from crags.modules.waitlist import router as waitlist_router  # noqa: F401
from crags.modules.webhooks import router as webhooks_router  # noqa: F401


class _DummyJob:
    def __init__(self, next_run_time=None) -> None:
        self.next_run_time = next_run_time


class _DummyScheduler:
    def __init__(self) -> None:
        self.running = False
        self._jobs: dict[str, _DummyJob] = {}

    def add_job(self, func, trigger=None, minutes=None, id=None, replace_existing=True, next_run_time=None):
        self._jobs[id or "job"] = _DummyJob(next_run_time=next_run_time)

    def start(self) -> None:
        self.running = True

    def shutdown(self, wait: bool = False) -> None:
        self.running = False

    def get_job(self, job_id: str):
        return self._jobs.get(job_id)


@pytest.fixture(scope="session")
def test_database_url() -> str:
    return os.environ["DATABASE_URL"]


@pytest.fixture(scope="session")
def engine(test_database_url: str):
    schema_name = f"test_{uuid.uuid4().hex}"

    admin_engine = create_engine(test_database_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema_name}"'))

    engine = create_engine(test_database_url, pool_pre_ping=True)

    @event.listens_for(engine, "connect")
    def set_search_path(dbapi_connection, connection_record) -> None:  # noqa: ANN001
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{schema_name}"')

    Base.metadata.create_all(engine)

    try:
        yield engine
    finally:
        engine.dispose()
        with admin_engine.connect() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture(autouse=True)
def reset_singletons() -> Generator[None, None, None]:
    from crags.core import cache
    from crags.modules.iam import service as iam_service

    cache_instance = get_cache()
    if hasattr(cache_instance, "delete"):
        for key in (KEY_SYSTEMS, KEY_POLICIES, KEY_BILLING_COSTS):
            cache_instance.delete(key)

    iam_service._rate_limiter = None
    iam_service._pr_rate_limiter = None
    yield
    iam_service._rate_limiter = None
    iam_service._pr_rate_limiter = None


@pytest.fixture(scope="function")
def db_session(engine) -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess, trans) -> None:  # noqa: ANN001
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    import crags.main as main_module

    def override_get_db():
        yield db_session

    monkeypatch.setattr(main_module, "ensure_super_admin", lambda db: None)
    monkeypatch.setattr(main_module, "_scheduler", _DummyScheduler())
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _make_user(
    *,
    username: str,
    email: str,
    password: str,
    role: UserRole,
    group: Group | None = None,
    is_active: bool = True,
) -> User:
    return User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
        group_id=group.id if group else None,
        is_active=is_active,
    )


@pytest.fixture
def test_group(db_session: Session) -> Group:
    group = Group(
        name="research-lab",
        concurrent_cpu_quota=256,
        concurrent_gpu_quota=32,
        concurrent_ram_quota=2048,
        concurrent_vram_quota=512,
        monthly_cpu_hours_quota=20000,
        monthly_gpu_hours_quota=5000,
        monthly_ram_gb_hours_quota=100000,
        monthly_vram_gb_hours_quota=25000,
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


@pytest.fixture
def other_group(db_session: Session) -> Group:
    group = Group(name="other-group")
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


@pytest.fixture
def super_admin(db_session: Session) -> User:
    user = _make_user(
        username="superadmin",
        email="superadmin@test.local",
        password="superadmin123",
        role=UserRole.SUPER_ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session: Session, test_group: Group) -> User:
    user = _make_user(
        username="admin",
        email="admin@test.local",
        password="admin12345",
        role=UserRole.ADMIN,
        group=test_group,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def member_user(db_session: Session, test_group: Group) -> User:
    user = _make_user(
        username="member",
        email="member@test.local",
        password="member12345",
        role=UserRole.MEMBER,
        group=test_group,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def group_lead_user(db_session: Session, test_group: Group) -> User:
    user = _make_user(
        username="lead",
        email="lead@test.local",
        password="lead12345",
        role=UserRole.GROUP_LEAD,
        group=test_group,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def inactive_user(db_session: Session, test_group: Group) -> User:
    user = _make_user(
        username="inactive",
        email="inactive@test.local",
        password="inactive12345",
        role=UserRole.MEMBER,
        group=test_group,
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def compute_system(db_session: Session) -> ComputeSystem:
    system = ComputeSystem(
        name="gpu-node-a",
        system_type=SystemType.GPU,
        cpu_cores=64,
        ram_gb=256,
        gpu_units=8,
        vram_gb=128,
        status=SystemStatus.ACTIVE,
    )
    db_session.add(system)
    db_session.commit()
    db_session.refresh(system)
    return system


@pytest.fixture
def maintenance_system(db_session: Session) -> ComputeSystem:
    system = ComputeSystem(
        name="gpu-node-maint",
        system_type=SystemType.GPU,
        cpu_cores=32,
        ram_gb=128,
        gpu_units=4,
        vram_gb=64,
        status=SystemStatus.MAINTENANCE,
    )
    db_session.add(system)
    db_session.commit()
    db_session.refresh(system)
    return system


@pytest.fixture
def second_system(db_session: Session) -> ComputeSystem:
    system = ComputeSystem(
        name="cpu-node-b",
        system_type=SystemType.CPU,
        cpu_cores=96,
        ram_gb=512,
        gpu_units=0,
        vram_gb=0,
        status=SystemStatus.ACTIVE,
    )
    db_session.add(system)
    db_session.commit()
    db_session.refresh(system)
    return system


def _window(hours_from_now: int = 2, duration_hours: int = 2) -> tuple[datetime, datetime]:
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=hours_from_now)
    end = start + timedelta(hours=duration_hours)
    return start, end


@pytest.fixture
def requested_booking(db_session: Session, member_user: User, compute_system: ComputeSystem) -> Booking:
    start, end = _window(hours_from_now=4, duration_hours=2)
    booking = Booking(
        system_id=compute_system.id,
        user_id=member_user.id,
        booking_period=Range(start.replace(tzinfo=None), end.replace(tzinfo=None)),
        req_cpu=8,
        req_gpu=1,
        req_ram=32,
        req_vram=16,
        access_type=AccessType.FOREGROUND,
        academic_category="research",
        project_title="Requested Booking",
        expected_deliverable="analysis",
        objective="Validate approval flow",
        status=BookingStatus.REQUESTED,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def confirmed_booking(db_session: Session, member_user: User, compute_system: ComputeSystem) -> Booking:
    start, end = _window(hours_from_now=6, duration_hours=3)
    booking = Booking(
        system_id=compute_system.id,
        user_id=member_user.id,
        booking_period=Range(start.replace(tzinfo=None), end.replace(tzinfo=None)),
        req_cpu=16,
        req_gpu=2,
        req_ram=64,
        req_vram=24,
        access_type=AccessType.FOREGROUND,
        academic_category="research",
        project_title="Confirmed Booking",
        expected_deliverable="report",
        objective="Exercise billing and analytics",
        status=BookingStatus.CONFIRMED,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def auth_headers() -> Callable[[User], dict[str, str]]:
    def factory(user: User) -> dict[str, str]:
        token, _, _ = create_access_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "group_id": user.group_id,
            }
        )
        return {"Authorization": f"Bearer {token}"}

    return factory


@pytest.fixture
def member_auth_headers(member_user: User, auth_headers: Callable[[User], dict[str, str]]) -> dict[str, str]:
    return auth_headers(member_user)


@pytest.fixture
def admin_auth_headers(admin_user: User, auth_headers: Callable[[User], dict[str, str]]) -> dict[str, str]:
    return auth_headers(admin_user)


@pytest.fixture
def super_admin_auth_headers(super_admin: User, auth_headers: Callable[[User], dict[str, str]]) -> dict[str, str]:
    return auth_headers(super_admin)


@pytest.fixture
def group_lead_auth_headers(group_lead_user: User, auth_headers: Callable[[User], dict[str, str]]) -> dict[str, str]:
    return auth_headers(group_lead_user)


@pytest.fixture
def booking_payload(compute_system: ComputeSystem) -> dict:
    start, end = _window(hours_from_now=8, duration_hours=2)
    return {
        "system_id": compute_system.id,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "req_cpu": 8,
        "req_gpu": 1,
        "req_ram": 32,
        "req_vram": 16,
        "access_type": "FOREGROUND",
        "academic_category": "research",
        "project_title": "Smoke Booking",
        "expected_deliverable": "model artifact",
        "objective": "exercise booking creation",
    }
