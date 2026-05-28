from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.waitlist import service
from crags.modules.waitlist.schemas import WaitlistEntryOut, WaitlistJoin

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistEntryOut, status_code=status.HTTP_201_CREATED)
def join(
    payload: WaitlistJoin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.join_waitlist(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[WaitlistEntryOut])
def list_entries(
    system_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_waitlist(db, system_id=system_id, actor_user=current_user)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if not service.cancel_waitlist_entry(db, entry_id, current_user):
            raise HTTPException(status_code=404, detail="Waitlist entry not found")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
