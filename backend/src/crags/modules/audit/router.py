from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.audit.models import AuditAction, AuditLog
from crags.modules.audit.service import export_audit_csv, list_audit_logs
from crags.modules.iam.dependencies import require_role
from crags.modules.iam.models import User, UserRole

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/actions")
def list_audit_actions(
    _: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    return [a.value for a in AuditAction]


@router.get("/")
def list_audit_events(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    table_name: Optional[str] = Query(default=None),
    action: Optional[AuditAction] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    from_time: Optional[datetime] = Query(default=None),
    to_time: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    logs = list_audit_logs(
        db,
        from_time=from_time,
        to_time=to_time,
        action=action.value if action else None,
        user_id=user_id,
        table_name=table_name,
        limit=limit,
        offset=offset,
    )
    return [
        {
            "id": e.id,
            "table_name": e.table_name,
            "record_id": e.record_id,
            "action": e.action,
            "timestamp": e.timestamp,
            "user_id": e.user_id,
        }
        for e in logs
    ]


@router.get("/export.csv")
def export_audit(
    from_time: Optional[datetime] = Query(default=None),
    to_time: Optional[datetime] = Query(default=None),
    action: Optional[AuditAction] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    csv_content = export_audit_csv(
        db,
        from_time=from_time,
        to_time=to_time,
        action=action.value if action else None,
        user_id=user_id,
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="crags_audit.csv"'},
    )
