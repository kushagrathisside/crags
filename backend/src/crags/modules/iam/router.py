from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from crags.core.config import settings
from crags.core.security import create_access_token
from crags.db.session import get_db
from crags.modules.iam.auth_service import authenticate_user
from crags.modules.iam.dependencies import get_current_user, require_role
from crags.modules.iam.models import Group, User, UserRole
from crags.modules.iam.schemas import (
    AuthSessionResponse,
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    GroupUsageSummary,
    LoginRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from crags.modules.iam.service import (
    create_group,
    create_user,
    group_usage_summary,
    is_super_admin,
    list_group_members,
    list_groups,
    list_users,
    role_from_external,
    serialize_user,
    update_group,
    update_user,
)

router = APIRouter(prefix="/api/v1", tags=["iam"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


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

    user = authenticate_user(db, identifier, data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value if user.role else UserRole.MEMBER.value,
            "group_id": user.group_id,
        }
    )
    _set_auth_cookie(response, token)
    return {"token_type": "cookie", "user": serialize_user(user)}


@router.post("/auth/logout")
def logout(response: Response):
    _clear_auth_cookie(response)
    return {"ok": True}


@router.get("/users/me", response_model=UserResponse)
def whoami(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/groups/{group_id}/members", response_model=list[UserResponse])
def get_group_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.GROUP_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if current_user.role == UserRole.GROUP_LEAD and current_user.group_id != group_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leads can access only their own group")

    return list_group_members(db, group_id)


@router.get("/groups/{group_id}/usage", response_model=GroupUsageSummary)
def get_group_usage(
    group_id: int,
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {UserRole.GROUP_LEAD, UserRole.ADMIN, UserRole.SUPER_ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if current_user.role == UserRole.GROUP_LEAD and current_user.group_id != group_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leads can access only their own group")

    try:
        return group_usage_summary(db, group_id, month)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/iam/groups",
    response_model=list[GroupResponse],
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
)
def get_groups(db: Session = Depends(get_db)):
    return list_groups(db)


@router.post(
    "/iam/groups",
    response_model=GroupResponse,
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
)
def add_group(data: GroupCreate, db: Session = Depends(get_db)):
    try:
        return create_group(db, data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists") from exc


@router.patch(
    "/iam/groups/{group_id}",
    response_model=GroupResponse,
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
)
def patch_group(group_id: int, data: GroupUpdate, db: Session = Depends(get_db)):
    try:
        return update_group(db, group_id, data.model_dump(exclude_unset=True))
    except ValueError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if detail == "Group not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group name already exists") from exc


@router.get(
    "/iam/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
)
def get_users(db: Session = Depends(get_db)):
    return list_users(db)


@router.post(
    "/iam/users",
    response_model=UserResponse,
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
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
        return create_user(db, data.model_dump())
    except ValueError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if detail == "Group not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc


@router.patch(
    "/iam/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN]))],
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super-admin can change roles")
        if existing.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super-admin can modify admin users")

    try:
        return update_user(db, user_id, payload)
    except ValueError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if detail in {"User not found", "Group not found"} else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc
