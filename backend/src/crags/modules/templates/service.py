from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.iam.models import User, UserRole
from crags.modules.templates.models import BookingTemplate
from crags.modules.templates.schemas import TemplateCreate, TemplateUpdate


def create_template(db: Session, payload: TemplateCreate, actor_user: User) -> BookingTemplate:
    t = BookingTemplate(user_id=actor_user.id, **payload.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def list_templates(db: Session, actor_user: User) -> list[BookingTemplate]:
    q = db.query(BookingTemplate)
    if actor_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        q = q.filter(BookingTemplate.user_id == actor_user.id)
    return q.order_by(BookingTemplate.updated_at.desc()).all()


def get_template(db: Session, template_id: int, actor_user: User) -> Optional[BookingTemplate]:
    t = db.query(BookingTemplate).filter(BookingTemplate.id == template_id).first()
    if not t:
        return None
    if actor_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN) and t.user_id != actor_user.id:
        raise PermissionError("Not authorized to access this template")
    return t


def update_template(db: Session, template_id: int, payload: TemplateUpdate, actor_user: User) -> Optional[BookingTemplate]:
    t = get_template(db, template_id, actor_user)
    if not t:
        return None
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete_template(db: Session, template_id: int, actor_user: User) -> bool:
    t = get_template(db, template_id, actor_user)
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True
