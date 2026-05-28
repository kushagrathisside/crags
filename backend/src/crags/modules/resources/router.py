from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from crags.core.cache import KEY_SYSTEMS, TTL_SYSTEMS, get_cache
from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user, require_admin
from crags.modules.iam.models import User
from crags.modules.resources.models import SystemStatus
from crags.modules.resources.schemas import SystemCreate, SystemResponse, SystemUpdate
from crags.modules.resources.service import (
    create_system,
    delete_system,
    get_system,
    list_systems,
    update_system,
)

router = APIRouter(prefix="/api/v1/systems", tags=["systems"])


@router.get("/", response_model=list[SystemResponse])
def get_systems(
    status: SystemStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Only cache the unfiltered list — filtered requests are less frequent
    # and mixing them into one key would require per-filter keys.
    if status is None:
        hit = get_cache().get(KEY_SYSTEMS)
        if hit is not None:
            return hit
    result = list_systems(db, status=status)
    if status is None:
        get_cache().set(KEY_SYSTEMS, jsonable_encoder(result), ttl=TTL_SYSTEMS)
    return result


@router.get("/{system_id}", response_model=SystemResponse)
def get_system_by_id(
    system_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        return get_system(db, system_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/", response_model=SystemResponse)
def add_system(
    data: SystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = create_system(db, data, current_user)
    get_cache().delete(KEY_SYSTEMS)
    return result


@router.patch("/{system_id}", response_model=SystemResponse)
def edit_system(
    system_id: int,
    data: SystemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        result = update_system(db, system_id, data, current_user)
    except ValueError as exc:
        status_code = 404 if "not found" in str(exc) else 409
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    get_cache().delete(KEY_SYSTEMS)
    return result


@router.delete("/{system_id}", response_model=SystemResponse)
def remove_system(
    system_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        result = delete_system(db, system_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    get_cache().delete(KEY_SYSTEMS)
    return result
