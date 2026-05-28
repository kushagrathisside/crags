from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import require_admin, get_current_user
from crags.modules.iam.models import User
from crags.modules.maintenance import service
from crags.modules.maintenance.schemas import MaintenanceWindowCreate, MaintenanceWindowOut

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceWindowOut])
def list_windows(
    system_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.list_maintenance_windows(db, system_id=system_id)


@router.post("", response_model=MaintenanceWindowOut, status_code=status.HTTP_201_CREATED)
def create_window(
    payload: MaintenanceWindowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        return service.create_maintenance_window(db, payload, actor_user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_window(
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not service.delete_maintenance_window(db, window_id, actor_user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Maintenance window not found")
