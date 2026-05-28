"""
Email delivery using Python's stdlib smtplib — no paid or external dependencies.

send_email() is the only public function. It is fire-and-forget:
  - When EMAIL_ENABLED=False  → logs the email to stdout (dev / CI mode).
  - When EMAIL_ENABLED=True   → connects to SMTP and sends. Errors are caught
                                 and logged so a failed delivery never raises to
                                 the caller or rolls back a DB transaction.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from crags.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email. Never raises — failures are logged and swallowed."""
    if not to:
        logger.warning("send_email called with empty recipient — skipping")
        return

    if not settings.EMAIL_ENABLED:
        logger.info(
            "EMAIL (dev mode — not sent)\n  To: %s\n  Subject: %s\n---\n%s\n---",
            to, subject, body,
        )
        return

    msg = EmailMessage()
    msg["From"]    = settings.EMAIL_FROM
    msg["To"]      = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        logger.info("Email sent  to=%s  subject=%r", to, subject)
    except Exception:
        logger.exception("Failed to send email to=%s subject=%r", to, subject)
