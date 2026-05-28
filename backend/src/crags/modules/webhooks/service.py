"""
Webhook Service
===============
Stores webhooks and fires HMAC-signed HTTP POST requests on system events.
Delivery is best-effort (fire-and-forget via a thread). The last status code
is recorded for observability.

HMAC signing: X-CRAGS-Signature header = 'sha256=' + hmac(secret, body, sha256).
Consumers verify by recomputing the HMAC and comparing.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

from sqlalchemy.orm import Session

from crags.modules.audit.models import AuditAction
from crags.modules.audit.service import emit_audit
from crags.modules.webhooks.models import Webhook
from crags.modules.webhooks.schemas import WebhookCreate, WebhookUpdate

logger = logging.getLogger(__name__)


def _sign_payload(secret: str, body: bytes) -> str:
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _fire(webhook_id: int, url: str, secret: Optional[str], payload: dict, db_factory) -> None:
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "CRAGS-Webhook/1.0"}
    if secret:
        headers["X-CRAGS-Signature"] = _sign_payload(secret, body)
    req = Request(url, data=body, headers=headers, method="POST")
    status_code: Optional[int] = None
    try:
        with urlopen(req, timeout=10) as resp:
            status_code = resp.status
    except URLError as exc:
        logger.warning("Webhook %d delivery failed: %s", webhook_id, exc)
    except Exception as exc:
        logger.warning("Webhook %d unexpected error: %s", webhook_id, exc)

    db: Session = db_factory()
    try:
        wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if wh:
            wh.last_triggered_at = datetime.now(timezone.utc)
            wh.last_status_code = status_code
            db.commit()
    finally:
        db.close()


def emit_event(event: str, payload: dict) -> None:
    """Called after state changes. Fires all active webhooks subscribed to the event."""
    from crags.db.session import SessionLocal
    db: Session = SessionLocal()
    try:
        hooks = db.query(Webhook).filter(Webhook.active.is_(True)).all()
        for wh in hooks:
            if event in wh.get_events() or "*" in wh.get_events():
                t = threading.Thread(
                    target=_fire,
                    args=(wh.id, wh.url, wh.secret, {"event": event, **payload}, SessionLocal),
                    daemon=True,
                )
                t.start()
    finally:
        db.close()


def create_webhook(db: Session, payload: WebhookCreate, actor_user_id: Optional[int] = None) -> Webhook:
    wh = Webhook(name=payload.name, url=payload.url, secret=payload.secret, active=payload.active, created_by=actor_user_id)
    wh.set_events(payload.events)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    emit_audit(db, AuditAction.WEBHOOK_CREATED, wh.id, actor_user_id, "webhooks")
    return wh


def list_webhooks(db: Session) -> list[Webhook]:
    return db.query(Webhook).order_by(Webhook.id).all()


def get_webhook(db: Session, webhook_id: int) -> Optional[Webhook]:
    return db.query(Webhook).filter(Webhook.id == webhook_id).first()


def update_webhook(db: Session, webhook_id: int, payload: WebhookUpdate) -> Optional[Webhook]:
    wh = get_webhook(db, webhook_id)
    if not wh:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "events" in data:
        wh.set_events(data.pop("events"))
    for k, v in data.items():
        setattr(wh, k, v)
    db.commit()
    db.refresh(wh)
    return wh


def delete_webhook(db: Session, webhook_id: int, actor_user_id: Optional[int] = None) -> bool:
    wh = get_webhook(db, webhook_id)
    if not wh:
        return False
    db.delete(wh)
    db.commit()
    emit_audit(db, AuditAction.WEBHOOK_DELETED, webhook_id, actor_user_id, "webhooks")
    return True
