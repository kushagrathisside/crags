from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.dependencies import require_admin
from crags.modules.iam.models import User
from crags.modules.webhooks import service
from crags.modules.webhooks.schemas import WebhookCreate, WebhookOut, WebhookUpdate

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("", response_model=list[WebhookOut])
def list_webhooks(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [WebhookOut.model_validate(wh) for wh in service.list_webhooks(db)]


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
def create_webhook(
    payload: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return WebhookOut.model_validate(service.create_webhook(db, payload, actor_user_id=current_user.id))


@router.get("/{webhook_id}", response_model=WebhookOut)
def get_webhook(webhook_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    wh = service.get_webhook(db, webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return WebhookOut.model_validate(wh)


@router.patch("/{webhook_id}", response_model=WebhookOut)
def update_webhook(
    webhook_id: int,
    payload: WebhookUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    wh = service.update_webhook(db, webhook_id, payload)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return WebhookOut.model_validate(wh)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not service.delete_webhook(db, webhook_id, actor_user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Webhook not found")
