from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.analytics import service
from crags.modules.analytics.schemas import AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _default_from() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def _default_to() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=AnalyticsSummary)
def get_analytics(
    from_time: datetime = Query(default_factory=_default_from),
    to_time: datetime = Query(default_factory=_default_to),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.get_analytics(db, from_time, to_time)


@router.get("/export.csv")
def export_csv(
    from_time: datetime = Query(default_factory=_default_from),
    to_time: datetime = Query(default_factory=_default_to),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    csv_content = service.export_analytics_csv(db, from_time, to_time)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="crags_analytics.csv"'},
    )
