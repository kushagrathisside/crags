from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.audit.models import AuditLog
from crags.modules.iam.dependencies import require_role
from crags.modules.iam.models import User, UserRole

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/")
def list_audit_events(
    limit: int = Query(default=200, ge=1, le=1000),
    table_name: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    query = db.query(AuditLog)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)

    events = query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": event.id,
            "table_name": event.table_name,
            "record_id": event.record_id,
            "action": event.action,
            "timestamp": event.timestamp,
            "user_id": event.user_id,
        }
        for event in events
    ]
