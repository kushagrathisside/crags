from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.health import service

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def get_health_status(
    system_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.get_system_health(db, system_id=system_id)


@router.post("/run-checks")
def trigger_health_checks(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    results = service.run_health_checks(db)
    return {"checked": len(results), "results": results}
