from __future__ import annotations

import hashlib
import logging
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from crags.core.config import settings
from crags.core.security import hash_password, verify_password
from crags.modules.iam.models import Group, PasswordResetToken, TokenBlacklist, User, UserRole
from crags.modules.scheduling.models import Booking, BookingStatus

ACTIVE_USAGE_STATUSES = [BookingStatus.REQUESTED, BookingStatus.CONFIRMED]

# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

def role_from_external(role_value: str) -> UserRole:
    normalized = role_value.strip().upper()
    if normalized == "RESOURCE_ADMIN":
        normalized = "ADMIN"
    return UserRole(normalized)


def role_to_external(role: UserRole | None) -> str:
    if role == UserRole.ADMIN:
        return "RESOURCE_ADMIN"
    return role.value if role else UserRole.MEMBER.value


def is_admin_role(role: UserRole | None) -> bool:
    return role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}


def is_super_admin(role: UserRole | None) -> bool:
    return role == UserRole.SUPER_ADMIN


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

def serialize_group(group: Group) -> dict:
    return {
        "id": group.id,
        "group_name": group.name,
        "concurrent_cpu_quota": group.concurrent_cpu_quota,
        "concurrent_gpu_quota": group.concurrent_gpu_quota,
        "concurrent_ram_quota": group.concurrent_ram_quota,
        "concurrent_vram_quota": group.concurrent_vram_quota,
        "monthly_cpu_hours_quota": group.monthly_cpu_hours_quota,
        "monthly_gpu_hours_quota": group.monthly_gpu_hours_quota,
        "monthly_ram_gb_hours_quota": group.monthly_ram_gb_hours_quota,
        "monthly_vram_gb_hours_quota": group.monthly_vram_gb_hours_quota,
    }


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": role_to_external(user.role),
        "group_id": user.group_id,
        "group_name": user.group.name if user.group else None,
        "is_active": bool(user.is_active),
        "auth_provider": user.auth_provider or "local",
        "created_at": user.created_at,
        "last_login": user.last_login,
    }


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def find_user_by_identifier(db: Session, identifier: str) -> User | None:
    trimmed = identifier.strip()
    if not trimmed:
        return None
    if "@" in trimmed:
        return db.query(User).filter(User.email == trimmed).first()
    return db.query(User).filter(User.username == trimmed).first()


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    user = find_user_by_identifier(db, identifier)
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    user.last_login = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Login rate limiter
#
# Two implementations share the same public API:
#   - RedisRateLimiter  — distributed, survives restarts, works across replicas
#   - InMemoryRateLimiter — fallback when Redis is not configured
#
# The active implementation is resolved once at first call via _get_rate_limiter().
# ---------------------------------------------------------------------------

_RL_WINDOW_SECONDS = 600   # 10-minute fixed window
_RL_MAX_FAILURES   = 5
_RL_KEY_PREFIX     = "crags:rl:"

# Password-reset throttle: 3 requests per hour per email.
_PRL_WINDOW_SECONDS = 3600
_PRL_MAX_ATTEMPTS   = 3
_PRL_KEY_PREFIX     = "crags:prl:"

# Lua script: atomically increment failure counter and set TTL on first failure.
# The TTL is only set when the key is created (count == 1), implementing a
# fixed window that resets _RL_WINDOW_SECONDS after the first failure.
_LUA_INCR = """
local n = redis.call('INCR', KEYS[1])
if n == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n
"""


class _RedisRateLimiter:
    def __init__(self, client: "redis.Redis") -> None:  # type: ignore[name-defined]
        self._r = client
        self._incr = client.register_script(_LUA_INCR)

    def _key(self, identifier: str) -> str:
        return f"{_RL_KEY_PREFIX}{identifier}"

    def check(self, identifier: str) -> None:
        raw = self._r.get(self._key(identifier))
        if raw is not None and int(raw) >= _RL_MAX_FAILURES:
            raise ValueError("Too many failed login attempts. Try again in 10 minutes.")

    def record_failure(self, identifier: str) -> None:
        self._incr(keys=[self._key(identifier)], args=[_RL_WINDOW_SECONDS])

    def clear(self, identifier: str) -> None:
        self._r.delete(self._key(identifier))


class _InMemoryRateLimiter:
    def __init__(self, window_seconds: int = _RL_WINDOW_SECONDS, max_attempts: int = _RL_MAX_FAILURES, error_message: str = "Too many failed login attempts. Try again in 10 minutes.") -> None:
        self._window = window_seconds
        self._max = max_attempts
        self._error_message = error_message
        self._lock = threading.Lock()
        self._failures: dict[str, list[float]] = defaultdict(list)

    def check(self, identifier: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._failures[identifier] = [
                t for t in self._failures[identifier]
                if now - t < self._window
            ]
            if len(self._failures[identifier]) >= self._max:
                raise ValueError(self._error_message)

    def record_failure(self, identifier: str) -> None:
        with self._lock:
            self._failures[identifier].append(time.monotonic())

    def clear(self, identifier: str) -> None:
        with self._lock:
            self._failures.pop(identifier, None)


_rate_limiter: "_RedisRateLimiter | _InMemoryRateLimiter | None" = None
_rl_init_lock = threading.Lock()


def _get_rate_limiter() -> "_RedisRateLimiter | _InMemoryRateLimiter":
    global _rate_limiter
    if _rate_limiter is not None:
        return _rate_limiter
    with _rl_init_lock:
        if _rate_limiter is not None:  # double-checked locking
            return _rate_limiter
        if settings.REDIS_URL:
            try:
                import redis as _redis
                client = _redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_timeout=2,
                    socket_connect_timeout=2,
                )
                client.ping()
                _rate_limiter = _RedisRateLimiter(client)
                logger.info("Rate limiter: Redis at %s", settings.REDIS_URL)
                return _rate_limiter
            except Exception:
                logger.warning(
                    "Rate limiter: Redis unavailable, falling back to in-memory"
                )
        _rate_limiter = _InMemoryRateLimiter()
        if not settings.REDIS_URL:
            logger.info("Rate limiter: in-memory (set REDIS_URL for distributed mode)")
        return _rate_limiter


def check_rate_limit(identifier: str) -> None:
    """Raise ValueError if the identifier is currently locked out."""
    _get_rate_limiter().check(identifier)


def record_login_failure(identifier: str) -> None:
    _get_rate_limiter().record_failure(identifier)


def clear_login_failures(identifier: str) -> None:
    _get_rate_limiter().clear(identifier)


# ---------------------------------------------------------------------------
# Password-reset rate limiter (in-memory only — token expiry is the hard guard)
# ---------------------------------------------------------------------------

_pr_rate_limiter: _InMemoryRateLimiter | None = None
_pr_rl_init_lock = threading.Lock()


def _get_pr_rate_limiter() -> _InMemoryRateLimiter:
    global _pr_rate_limiter
    if _pr_rate_limiter is not None:
        return _pr_rate_limiter
    with _pr_rl_init_lock:
        if _pr_rate_limiter is None:
            _pr_rate_limiter = _InMemoryRateLimiter(
                window_seconds=_PRL_WINDOW_SECONDS,
                max_attempts=_PRL_MAX_ATTEMPTS,
                error_message="Too many password-reset requests. Try again in 1 hour.",
            )
        return _pr_rate_limiter


def check_password_reset_rate_limit(email: str) -> None:
    _get_pr_rate_limiter().check(email)


def record_password_reset_attempt(email: str) -> None:
    _get_pr_rate_limiter().record_failure(email)


# ---------------------------------------------------------------------------
# Token blacklist
# ---------------------------------------------------------------------------

def blacklist_token(db: Session, jti: str, expires_at: datetime) -> None:
    """Add a JTI to the revocation list."""
    entry = TokenBlacklist(jti=jti, expires_at=expires_at)
    db.merge(entry)  # idempotent if already present
    db.commit()


def is_token_blacklisted(db: Session, jti: str) -> bool:
    return db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first() is not None


def cleanup_expired_blacklist(db: Session) -> int:
    """Delete blacklist entries whose tokens have already expired. Returns count removed."""
    now = datetime.now(timezone.utc)
    deleted = (
        db.query(TokenBlacklist)
        .filter(TokenBlacklist.expires_at < now)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

def create_password_reset_token(db: Session, email: str) -> str | None:
    """
    Generate a password reset token for the given email.
    Returns the raw token (to be sent to the user), or None if email not found.
    Callers should not reveal whether None means "not found" to the client.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return raw_token


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> bool:
    """
    Validate the raw token and set the new password.
    Returns True on success, False if the token is invalid/expired/used.
    """
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.expires_at > now,
            PasswordResetToken.used_at.is_(None),
        )
        .first()
    )
    if not record:
        return False

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        return False

    new_pw = new_password.strip()
    if not new_pw:
        return False

    user.hashed_password = hash_password(new_pw)
    record.used_at = now
    db.add(user)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Audit logging for auth events
# ---------------------------------------------------------------------------

def _audit_auth(db: Session, action: "AuditAction", user_id: int | None) -> None:
    try:
        from crags.modules.audit.models import AuditLog  # local to avoid circular import
        db.add(
            AuditLog(
                table_name="auth",
                record_id=user_id,
                action=action,
                timestamp=datetime.now(timezone.utc),
                user_id=user_id,
            )
        )
        db.commit()
    except Exception:
        db.rollback()


def audit_login_success(db: Session, user_id: int) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_LOGIN, user_id)


def audit_login_failure(db: Session, user_id: int | None) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_FAILURE, user_id)


def audit_logout(db: Session, user_id: int) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_LOGOUT, user_id)


def audit_token_refresh(db: Session, user_id: int) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_REFRESH, user_id)


def audit_password_reset_requested(db: Session, user_id: int) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_RESET_REQUESTED, user_id)


def audit_password_reset_completed(db: Session, user_id: int) -> None:
    from crags.modules.audit.models import AuditAction
    _audit_auth(db, AuditAction.AUTH_RESET_COMPLETED, user_id)


def _audit_iam(db: Session, action: "AuditAction", record_id: int | None, actor_user_id: int | None) -> None:
    """Write an IAM management audit entry in its own commit (best-effort)."""
    try:
        from crags.modules.audit.models import AuditLog
        db.add(
            AuditLog(
                table_name="iam",
                record_id=record_id,
                action=action,
                timestamp=datetime.now(timezone.utc),
                user_id=actor_user_id,
            )
        )
        db.commit()
    except Exception:
        db.rollback()


# ---------------------------------------------------------------------------
# Group / User CRUD
# ---------------------------------------------------------------------------

def _validate_group_exists(db: Session, group_id: int | None) -> None:
    if group_id is None:
        return
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")


def list_groups(db: Session) -> list[dict]:
    groups = db.query(Group).order_by(Group.name.asc()).all()
    return [serialize_group(group) for group in groups]


def create_group(db: Session, payload: dict, actor_user_id: int | None = None) -> dict:
    name = str(payload.get("group_name", "")).strip()
    if not name:
        raise ValueError("group_name is required")

    group = Group(
        name=name,
        concurrent_cpu_quota=payload.get("concurrent_cpu_quota"),
        concurrent_gpu_quota=payload.get("concurrent_gpu_quota"),
        concurrent_ram_quota=payload.get("concurrent_ram_quota"),
        concurrent_vram_quota=payload.get("concurrent_vram_quota"),
        monthly_cpu_hours_quota=payload.get("monthly_cpu_hours_quota"),
        monthly_gpu_hours_quota=payload.get("monthly_gpu_hours_quota"),
        monthly_ram_gb_hours_quota=payload.get("monthly_ram_gb_hours_quota"),
        monthly_vram_gb_hours_quota=payload.get("monthly_vram_gb_hours_quota"),
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    from crags.modules.audit.models import AuditAction
    _audit_iam(db, AuditAction.GROUP_CREATED, group.id, actor_user_id)
    return serialize_group(group)


def update_group(db: Session, group_id: int, payload: dict, actor_user_id: int | None = None) -> dict:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")

    if "group_name" in payload and payload["group_name"] is not None:
        next_name = str(payload["group_name"]).strip()
        if not next_name:
            raise ValueError("group_name cannot be blank")
        group.name = next_name

    for field in (
        "concurrent_cpu_quota",
        "concurrent_gpu_quota",
        "concurrent_ram_quota",
        "concurrent_vram_quota",
        "monthly_cpu_hours_quota",
        "monthly_gpu_hours_quota",
        "monthly_ram_gb_hours_quota",
        "monthly_vram_gb_hours_quota",
    ):
        if field in payload:
            setattr(group, field, payload[field])

    db.add(group)
    db.commit()
    db.refresh(group)
    from crags.modules.audit.models import AuditAction
    _audit_iam(db, AuditAction.GROUP_UPDATED, group.id, actor_user_id)
    return serialize_group(group)


def list_users(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.id.asc()).all()
    return [serialize_user(user) for user in users]


def create_user(db: Session, payload: dict, actor_user_id: int | None = None) -> dict:
    username = str(payload.get("username", "")).strip()
    if not username:
        raise ValueError("username is required")

    password = str(payload.get("password", "")).strip()
    if not password:
        raise ValueError("password is required")

    role = role_from_external(str(payload.get("role", "MEMBER")))
    group_id = payload.get("group_id")
    _validate_group_exists(db, group_id)

    user = User(
        username=username,
        email=str(payload.get("email")).strip() if payload.get("email") else None,
        hashed_password=hash_password(password),
        role=role,
        group_id=group_id,
        is_active=bool(payload.get("is_active", True)),
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    from crags.modules.audit.models import AuditAction
    _audit_iam(db, AuditAction.USER_CREATED, user.id, actor_user_id)
    return serialize_user(user)


def update_user(db: Session, user_id: int, payload: dict, actor_user_id: int | None = None) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    if "email" in payload:
        user.email = str(payload["email"]).strip() if payload["email"] else None

    if "group_id" in payload:
        _validate_group_exists(db, payload["group_id"])
        user.group_id = payload["group_id"]

    if "is_active" in payload and payload["is_active"] is not None:
        user.is_active = bool(payload["is_active"])

    if "role" in payload and payload["role"]:
        user.role = role_from_external(str(payload["role"]))

    if "password" in payload and payload["password"]:
        raw_password = str(payload["password"]).strip()
        if not raw_password:
            raise ValueError("password cannot be blank")
        user.hashed_password = hash_password(raw_password)

    db.add(user)
    db.commit()
    db.refresh(user)
    from crags.modules.audit.models import AuditAction
    _audit_iam(db, AuditAction.USER_UPDATED, user.id, actor_user_id)
    return serialize_user(user)


def list_group_members(db: Session, group_id: int) -> list[dict]:
    users = db.query(User).filter(User.group_id == group_id).order_by(User.id.asc()).all()
    return [serialize_user(user) for user in users]


# ---------------------------------------------------------------------------
# Group usage
# ---------------------------------------------------------------------------

def _month_window(month: str | None) -> tuple[datetime, datetime, str]:
    if month:
        try:
            year_text, month_text = month.split("-", 1)
            year = int(year_text)
            month_num = int(month_text)
        except Exception as exc:
            raise ValueError("month must be in YYYY-MM format") from exc
    else:
        now = datetime.now(timezone.utc)
        year = now.year
        month_num = now.month

    if month_num < 1 or month_num > 12:
        raise ValueError("month must be in YYYY-MM format")

    month_start = datetime(year, month_num, 1)
    if month_num == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month_num + 1, 1)

    return month_start, month_end, f"{year:04d}-{month_num:02d}"



def group_usage_summary(db: Session, group_id: int, month: str | None) -> dict:
    """
    Compute resource-hours consumed by a group in a given month.

    The overlap between each booking's window and the month boundary is computed
    entirely in Postgres via a single aggregate query — no rows are loaded into
    Python, and the calculation scales to arbitrarily large booking histories.

    The Lua CTE computes:
        overlap = booking_period * tsrange(month_start, month_end)
    then extracts the duration in hours and multiplies by each resource field.
    """
    from sqlalchemy import text

    month_start, month_end, month_label = _month_window(month)

    # Active statuses as a literal tuple safe for the IN clause.
    active_statuses = tuple(s.value for s in ACTIVE_USAGE_STATUSES)

    row = db.execute(
        text("""
            WITH overlaps AS (
                SELECT
                    b.req_cpu,
                    b.req_gpu,
                    b.req_ram,
                    b.req_vram,
                    b.booking_period * tsrange(:month_start, :month_end) AS overlap
                FROM bookings b
                JOIN users u ON u.id = b.user_id
                WHERE u.group_id  = :group_id
                  AND b.status    IN :statuses
                  AND b.booking_period && tsrange(:month_start, :month_end)
                  AND lower(b.booking_period) IS NOT NULL
                  AND upper(b.booking_period) IS NOT NULL
            )
            SELECT
                COUNT(*)                                                           AS bookings_count,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM upper(overlap) - lower(overlap)) / 3600.0
                    * req_cpu
                ), 0)                                                              AS cpu_hours,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM upper(overlap) - lower(overlap)) / 3600.0
                    * req_gpu
                ), 0)                                                              AS gpu_hours,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM upper(overlap) - lower(overlap)) / 3600.0
                    * req_ram
                ), 0)                                                              AS ram_gb_hours,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM upper(overlap) - lower(overlap)) / 3600.0
                    * req_vram
                ), 0)                                                              AS vram_gb_hours
            FROM overlaps
        """),
        {
            "group_id":   group_id,
            "month_start": month_start,
            "month_end":   month_end,
            "statuses":    active_statuses,
        },
    ).first()

    return {
        "group_id":       group_id,
        "month":          month_label,
        "cpu_hours":      round(float(row.cpu_hours), 2),
        "gpu_hours":      round(float(row.gpu_hours), 2),
        "ram_gb_hours":   round(float(row.ram_gb_hours), 2),
        "vram_gb_hours":  round(float(row.vram_gb_hours), 2),
        "bookings_count": int(row.bookings_count),
    }


# ---------------------------------------------------------------------------
# Super admin bootstrap
# ---------------------------------------------------------------------------

def ensure_super_admin(db: Session) -> None:
    seed_password = settings.SUPERADMIN_PASSWORD.strip()
    if not seed_password:
        return

    username = settings.SUPERADMIN_USERNAME.strip()
    email = settings.SUPERADMIN_EMAIL.strip()
    group_name = settings.SUPERADMIN_GROUP_NAME.strip() or "platform-admins"

    group = db.query(Group).filter(Group.name == group_name).first()
    if not group:
        group = Group(name=group_name)
        db.add(group)
        db.flush()

    user = db.query(User).filter(User.username == username).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            username=username,
            email=email or None,
            hashed_password=hash_password(seed_password),
            role=UserRole.SUPER_ADMIN,
            group_id=group.id,
            is_active=True,
            auth_provider="local",
        )
        db.add(user)
        db.commit()
        return

    user.role = UserRole.SUPER_ADMIN
    user.group_id = group.id
    user.is_active = True
    if email:
        user.email = email
    if not user.hashed_password:
        user.hashed_password = hash_password(seed_password)

    db.add(user)
    db.commit()
