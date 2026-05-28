from __future__ import annotations

from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from crags.core.config import settings
from crags.core.security import decode_token
from crags.db.session import get_db
from crags.modules.iam.models import User, UserRole
from crags.modules.iam.service import is_token_blacklisted, role_from_external

cookie_scheme = APIKeyCookie(name=settings.AUTH_COOKIE_NAME, auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _resolve_token(
    cookie_token: str | None,
    bearer: HTTPAuthorizationCredentials | None,
) -> str | None:
    if cookie_token:
        return cookie_token
    if bearer and bearer.credentials:
        return bearer.credentials
    return None


def get_current_user(
    db: Session = Depends(get_db),
    cookie_token: str | None = Depends(cookie_scheme),
    bearer: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    token = _resolve_token(cookie_token, bearer)
    if not token:
        raise _unauthorized()

    payload = decode_token(token)
    if not payload:
        raise _unauthorized("Invalid or expired token")

    if payload.get("type") != "access":
        raise _unauthorized("Invalid token type")

    jti = payload.get("jti")
    if not jti:
        raise _unauthorized("Token missing jti")

    if is_token_blacklisted(db, jti):
        raise _unauthorized("Token has been revoked")

    subject = payload.get("sub")
    try:
        user_id = int(str(subject))
    except Exception as exc:
        raise _unauthorized("Invalid token subject") from exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise _unauthorized("User not found")

    if not user.is_active:
        raise _unauthorized("User is inactive")

    return user


def require_role(allowed_roles: Iterable[str | UserRole]):
    normalized: set[UserRole] = set()
    for role in allowed_roles:
        if isinstance(role, UserRole):
            normalized.add(role)
        else:
            normalized.add(role_from_external(role))

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in normalized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker


# Convenience guards matching the RBAC matrix.
require_admin = require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])
require_super_admin = require_role([UserRole.SUPER_ADMIN])


def own_group_or_admin(group_id_param: str = "group_id"):
    """
    FastAPI dependency factory. Ensures the caller is either an admin role
    or a GROUP_LEAD accessing their own group.

    Usage:
        @router.get("/groups/{group_id}/...")
        def handler(
            group_id: int,
            current_user: User = Depends(own_group_or_admin()),
        ): ...
    """
    def checker(
        group_id: int,
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
            return current_user
        if (
            current_user.role == UserRole.GROUP_LEAD
            and current_user.group_id == group_id
        ):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return checker
