from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import APIKeyCookie
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from crags.core.config import settings
from crags.core.security import create_access_token, create_refresh_token, decode_token
from crags.db.session import get_db
from crags.modules.iam.dependencies import (
    get_current_user,
    own_group_or_admin,
    require_admin,
    require_role,
    require_super_admin,
)
from crags.modules.iam.models import Group, User, UserRole
from crags.modules.iam.schemas import (
    AuthSessionResponse,
    ForgotPasswordRequest,
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    GroupUsageSummary,
    LoginRequest,
    ResetPasswordRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from crags.modules.iam.service import (
    audit_login_failure,
    audit_login_success,
    audit_logout,
    audit_password_reset_completed,
    audit_password_reset_requested,
    audit_token_refresh,
    authenticate_user,
    blacklist_token,
    check_password_reset_rate_limit,
    check_rate_limit,
    clear_login_failures,
    create_group,
    create_password_reset_token,
    create_user,
    group_usage_summary,
    is_super_admin,
    is_token_blacklisted,
    list_group_members,
    list_groups,
    list_users,
    record_login_failure,
    record_password_reset_attempt,
    reset_password_with_token,
    role_from_external,
    serialize_user,
    update_group,
    update_user,
)

router = APIRouter(prefix="/api/v1", tags=["iam"])

_refresh_cookie_scheme = APIKeyCookie(name=settings.REFRESH_COOKIE_NAME, auto_error=False)


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------

def _set_access_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=max_age,
        path="/",
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400,
        path="/api/v1/auth/refresh",  # refresh cookie scoped to refresh endpoint only
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/api/v1/auth/refresh",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def _issue_tokens(response: Response, user: User) -> dict:
    """Mint a fresh access + refresh token pair, set cookies, return session dict."""
    token_data = {
        "sub": str(user.id),
        "role": user.role.value if user.role else UserRole.MEMBER.value,
        "group_id": user.group_id,
    }
    access_token, _access_jti, access_expires = create_access_token(token_data)
    refresh_token, _refresh_jti, _refresh_expires = create_refresh_token(user.id)

    _set_access_cookie(response, access_token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    _set_refresh_cookie(response, refresh_token)

    return {
        "token_type": "cookie",
        "user": serialize_user(user),
        "access_token_expires_at": access_expires,
    }


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/login", response_model=AuthSessionResponse)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        identifier = data.resolve_identifier()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Rate limit check before attempting authentication.
    try:
        check_rate_limit(identifier)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    user = authenticate_user(db, identifier, data.password)
    if not user:
        record_login_failure(identifier)
        # Attempt to find the user only to log a user_id for the audit entry.
        from crags.modules.iam.service import find_user_by_identifier
        failed_user = find_user_by_identifier(db, identifier)
        audit_login_failure(db, failed_user.id if failed_user else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    clear_login_failures(identifier)
    audit_login_success(db, user.id)
    return _issue_tokens(response, user)


@router.post("/auth/refresh", response_model=AuthSessionResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Depends(_refresh_cookie_scheme),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    jti = payload.get("jti")
    if not jti or is_token_blacklisted(db, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    try:
        user_id = int(str(payload.get("sub")))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate: revoke the old refresh token, issue a new pair.
    from datetime import datetime, timezone
    refresh_exp = payload.get("exp")
    if refresh_exp:
        blacklist_token(db, jti, datetime.fromtimestamp(refresh_exp, tz=timezone.utc))

    audit_token_refresh(db, user.id)
    return _issue_tokens(response, user)


@router.post("/auth/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Revoke the current access token (if valid) and clear both cookies.
    Succeeds even if the access token is already expired — we just clear cookies.
    """
    user_id: int | None = None

    # Try to extract the access token and blacklist its JTI.
    raw_access = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if raw_access:
        payload = decode_token(raw_access)
        if payload and payload.get("type") == "access":
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                from datetime import datetime, timezone
                blacklist_token(db, jti, datetime.fromtimestamp(exp, tz=timezone.utc))
            user_id = payload.get("sub")
            try:
                user_id = int(str(user_id))
            except Exception:
                user_id = None

    # Also revoke the refresh token if present.
    raw_refresh = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if raw_refresh:
        payload = decode_token(raw_refresh)
        if payload and payload.get("type") == "refresh":
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                from datetime import datetime, timezone
                blacklist_token(db, jti, datetime.fromtimestamp(exp, tz=timezone.utc))

    _clear_auth_cookies(response)

    if user_id:
        audit_logout(db, user_id)

    return {"ok": True}


@router.post("/auth/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Initiate a password reset. Always returns 200 to avoid leaking whether
    the email is registered. The reset link is delivered by email.
    """
    from crags.modules.iam.service import find_user_by_identifier
    from crags.modules.notifications.service import send_email
    from crags.modules.notifications.templates import password_reset_email

    # Rate-limit by email address regardless of whether the account exists.
    try:
        check_password_reset_rate_limit(data.email)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    record_password_reset_attempt(data.email)

    raw_token = create_password_reset_token(db, data.email)

    if raw_token:
        user = find_user_by_identifier(db, data.email)
        if user:
            audit_password_reset_requested(db, user.id)
            if user.email:
                reset_url = (
                    f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
                )
                send_email(user.email, *password_reset_email(reset_url))

    return {"message": "If the email is registered, a reset link has been sent."}


@router.post("/auth/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    ok = reset_password_with_token(db, data.token, data.new_password)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already-used reset token",
        )
    return {"message": "Password updated. Please log in with your new password."}


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

@router.get("/users/me", response_model=UserResponse)
def whoami(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


# ---------------------------------------------------------------------------
# Group endpoints
# ---------------------------------------------------------------------------

@router.get("/groups/{group_id}/members", response_model=list[UserResponse])
def get_group_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(own_group_or_admin()),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return list_group_members(db, group_id)


@router.get("/groups/{group_id}/usage", response_model=GroupUsageSummary)
def get_group_usage(
    group_id: int,
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(own_group_or_admin()),
):
    try:
        return group_usage_summary(db, group_id, month)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/iam/groups",
    response_model=list[GroupResponse],
    dependencies=[Depends(require_admin)],
)
def get_groups(db: Session = Depends(get_db)):
    return list_groups(db)


@router.post(
    "/iam/groups",
    response_model=GroupResponse,
)
def add_group(data: GroupCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    try:
        return create_group(db, data.model_dump(), actor_user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists") from exc


@router.patch(
    "/iam/groups/{group_id}",
    response_model=GroupResponse,
)
def patch_group(group_id: int, data: GroupUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    try:
        return update_group(db, group_id, data.model_dump(exclude_unset=True), actor_user_id=current_user.id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if detail == "Group not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists") from exc


# ---------------------------------------------------------------------------
# User management endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/iam/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_admin)],
)
def get_users(db: Session = Depends(get_db)):
    return list_users(db)


@router.post(
    "/iam/users",
    response_model=UserResponse,
    dependencies=[Depends(require_admin)],
)
def add_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_role = role_from_external(data.role)
    if not is_super_admin(current_user.role) and target_role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super-admin can assign admin roles",
        )
    try:
        return create_user(db, data.model_dump(), actor_user_id=current_user.id)
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if detail == "Group not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc


@router.patch(
    "/iam/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_admin)],
)
def patch_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(User).filter(User.id == user_id).first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    payload = data.model_dump(exclude_unset=True)
    if not is_super_admin(current_user.role):
        if "role" in payload:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super-admin can change roles",
            )
        if existing.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super-admin can modify admin users",
            )

    try:
        return update_user(db, user_id, payload, actor_user_id=current_user.id)
    except ValueError as exc:
        detail = str(exc)
        code = (
            status.HTTP_404_NOT_FOUND
            if detail in {"User not found", "Group not found"}
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from exc
