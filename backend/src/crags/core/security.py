import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from crags.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw_password: str) -> str:
    return pwd_context.hash(raw_password)


def verify_password(raw_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(raw_password, hashed_password)


def _new_jti() -> str:
    return str(uuid.uuid4())


def create_access_token(
    data: dict[str, Any],
    expires_minutes: int | None = None,
) -> tuple[str, str, datetime]:
    """Return (encoded_token, jti, expires_at)."""
    to_encode = data.copy()
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = _new_jti()
    to_encode.update({"exp": expire, "iat": int(now.timestamp()), "jti": jti, "type": "access"})
    token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expire


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Return (encoded_token, jti, expires_at)."""
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = _new_jti()
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": jti,
        "exp": expire,
        "iat": int(now.timestamp()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti, expire


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and verify any CRAGS JWT. Returns None on any error."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# Kept for callsites that haven't been updated yet.
decode_access_token = decode_token
