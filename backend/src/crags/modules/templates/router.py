from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import get_current_user
from crags.modules.iam.models import User
from crags.modules.templates import service
from crags.modules.templates.schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_templates(db, current_user)


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_template(db, payload, current_user)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        t = service.get_template(db, template_id, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.patch("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        t = service.update_template(db, template_id, payload, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if not service.delete_template(db, template_id, current_user):
            raise HTTPException(status_code=404, detail="Template not found")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
