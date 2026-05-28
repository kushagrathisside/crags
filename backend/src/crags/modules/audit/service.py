import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.audit.models import AuditAction, AuditLog

DEFAULT_RETAIN_DAYS = 90


def emit_audit(
    db: Session,
    action: AuditAction,
    record_id: Optional[int],
    actor_user_id: Optional[int],
    table_name: str = "system",
) -> None:
    """Best-effort audit log write — never raises."""
    try:
        db.add(AuditLog(
            table_name=table_name,
            record_id=record_id,
            action=action,
            timestamp=datetime.now(timezone.utc),
            user_id=actor_user_id,
        ))
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def cleanup_old_audit_logs(db: Session, retain_days: int = DEFAULT_RETAIN_DAYS) -> int:
    """Delete audit rows older than retain_days. Returns the number of rows deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retain_days)
    deleted = (
        db.query(AuditLog)
        .filter(AuditLog.timestamp < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def list_audit_logs(
    db: Session,
    *,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    table_name: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[AuditLog]:
    q = db.query(AuditLog)
    if from_time:
        q = q.filter(AuditLog.timestamp >= from_time)
    if to_time:
        q = q.filter(AuditLog.timestamp <= to_time)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    if table_name:
        q = q.filter(AuditLog.table_name == table_name)
    return q.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset).all()


def export_audit_csv(
    db: Session,
    *,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
) -> str:
    logs = list_audit_logs(db, from_time=from_time, to_time=to_time, action=action, user_id=user_id, limit=10000, offset=0)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "timestamp", "action", "table_name", "record_id", "user_id"])
    for log in logs:
        writer.writerow([log.id, log.timestamp.isoformat() if log.timestamp else "", log.action, log.table_name, log.record_id, log.user_id])
    return buf.getvalue()
