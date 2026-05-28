# Notifications Service

This document covers the email notification layer: delivery mechanism, templates, trigger points, configuration, and extension guide.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Email Templates](#email-templates)
4. [Trigger Points](#trigger-points)
5. [Password Reset Flow Change](#password-reset-flow-change)
6. [Configuration Reference](#configuration-reference)
7. [Dev vs Production Mode](#dev-vs-production-mode)
8. [SMTP Compatibility](#smtp-compatibility)
9. [Adding a New Email](#adding-a-new-email)
10. [Module Layout](#module-layout)

---

## Overview

The Notifications service sends plain-text emails for three events: password reset, booking confirmed, and booking preempted. It uses Python's built-in `smtplib` — no third-party email library or paid service is required.

Email delivery is **fire-and-forget**: a failed send is logged but never raises to the caller and never rolls back a database transaction.

---

## Architecture

```
Event occurs in a service layer
        │
        ▼
notifications/service.py :: send_email(to, subject, body)
        │
        ├── EMAIL_ENABLED=False  →  log to stdout (dev / CI)
        │
        └── EMAIL_ENABLED=True   →  smtplib.SMTP  →  SMTP relay
                                        │
                                        ├── STARTTLS  (SMTP_USE_TLS=True)
                                        ├── login()   (if SMTP_USER set)
                                        └── send_message()
```

`smtplib` is part of the Python standard library. **No additional packages are installed.**

---

## Email Templates

All templates live in `notifications/templates.py`. Each returns `(subject: str, body: str)`. Content is plain text — no HTML, no templating engine.

### `password_reset_email(reset_url)`

Triggered by `POST /api/v1/auth/forgot-password`.

```
Subject: CRAGS — Password reset request

You requested a password reset for your CRAGS account.

Click the link below to set a new password. The link expires in 60 minutes
and can only be used once.

  https://crags.example.com/reset-password?token=Xk9mR3...

If you did not request this reset, you can safely ignore this email.
```

`reset_url` is constructed as `{FRONTEND_URL}/reset-password?token={raw_token}`.

---

### `booking_confirmed_email(...)`

Triggered immediately after a booking is committed to the database.

```
Subject: CRAGS — Booking #42 confirmed on gpu-cluster-01

Hi alice,

Your resource booking has been confirmed.

  System   : gpu-cluster-01
  Window   : 2026-06-01T09:00:00+00:00 → 2026-06-01T17:00:00+00:00
  CPU      : 8 cores
  GPU      : 2 units
  RAM      : 64 GB
  VRAM     : 80 GB
  Booking  : #42
```

Parameters: `username`, `system_name`, `start_time`, `end_time`, `req_cpu`, `req_gpu`, `req_ram`, `req_vram`, `booking_id`.

---

### `booking_preempted_email(...)`

Triggered for each background booking that is preempted to free capacity for a foreground job.

```
Subject: CRAGS — Booking #37 preempted on gpu-cluster-01

Hi bob,

Your background booking has been preempted to free capacity for a foreground job.

  System   : gpu-cluster-01
  Window   : 2026-06-01T10:00:00+00:00 → 2026-06-01T14:00:00+00:00
  Booking  : #37

You can submit a new booking request in the CRAGS portal at any time.
```

Parameters: `username`, `system_name`, `start_time`, `end_time`, `booking_id`.

---

## Trigger Points

| Event | File | Condition |
|-------|------|-----------|
| Password reset requested | `iam/router.py` → `forgot_password()` | User exists and has an email address |
| Booking confirmed | `scheduling/service.py` → `create_booking()` | After `db.commit()`; actor user has an email |
| Booking preempted | `scheduling/service.py` → `preempt_background_jobs()` | Per preempted job; owner has an email |

Email is only sent when the user has a non-empty `email` field. If `email` is `None` or empty, the send is skipped silently.

---

## Password Reset Flow Change

Prior to this service, `POST /auth/forgot-password` returned the raw reset token in the response body — a development shortcut that would leak the token in production. That field is now removed.

**Old response:**
```json
{
  "message": "If the email is registered, a reset token has been issued.",
  "reset_token": "Xk9mR3..."
}
```

**New response:**
```json
{
  "message": "If the email is registered, a reset link has been sent."
}
```

The reset link is delivered only via email. In dev mode (`EMAIL_ENABLED=False`) the link is logged to the backend's stdout so you can still test the flow without an SMTP server.

---

## Configuration Reference

All variables are read from environment / `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_ENABLED` | `false` | `false` = log only, no SMTP connection opened |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL prepended to password reset links |
| `EMAIL_FROM` | `crags@localhost` | `From:` header on all outgoing mail |
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (587 = STARTTLS submission, 465 = implicit TLS, 25 = plain) |
| `SMTP_USER` | _(empty)_ | SMTP login username — leave empty to skip auth |
| `SMTP_PASSWORD` | _(empty)_ | SMTP login password |
| `SMTP_USE_TLS` | `true` | Call `STARTTLS` before authenticating |

### Example `.env` for production with an SMTP relay

```env
EMAIL_ENABLED=true
FRONTEND_URL=https://crags.example.com
EMAIL_FROM=noreply@crags.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@crags.example.com
SMTP_PASSWORD=supersecret
SMTP_USE_TLS=true
```

### Example `.env` for local dev (Mailpit / MailHog)

```env
EMAIL_ENABLED=true
FRONTEND_URL=http://localhost:5173
EMAIL_FROM=crags@localhost
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_USE_TLS=false
```

[Mailpit](https://github.com/axllent/mailpit) and [MailHog](https://github.com/mailhog/MailHog) are free, open-source local SMTP catchers with a web UI — ideal for testing email in development without sending real mail.

---

## Dev vs Production Mode

| Setting | Behaviour |
|---------|-----------|
| `EMAIL_ENABLED=false` (default) | `send_email()` logs the full email (To, Subject, body) at `INFO` level and returns. No socket is opened. |
| `EMAIL_ENABLED=true` | Connects to `SMTP_HOST:SMTP_PORT`, optionally calls `STARTTLS` and `login()`, then sends. Any exception is caught and logged at `ERROR` level — the caller never sees it. |

---

## SMTP Compatibility

`smtplib` works with any standards-compliant SMTP server or relay:

| Provider | Notes |
|----------|-------|
| Postfix / Sendmail | Port 25 or 587, `SMTP_USE_TLS` as needed |
| Mailpit / MailHog (dev) | Port 1025, `SMTP_USE_TLS=false` |
| Gmail SMTP | Port 587, `SMTP_USE_TLS=true`, app password required |
| Brevo (Sendinblue) | Port 587, free tier available |
| Mailgun SMTP | Port 587, free tier available |
| AWS SES SMTP | Port 587, IAM credentials as user/password |

All of the above are free to self-host or have a free tier. None require a paid SDK or proprietary library.

---

## Adding a New Email

1. **Add a template** in `notifications/templates.py`:

```python
def my_event_email(*, param1: str, param2: int) -> tuple[str, str]:
    subject = "CRAGS — My event"
    body = f"..."
    return subject, body
```

2. **Call `send_email`** at the relevant point in the service layer:

```python
from crags.modules.notifications.service import send_email
from crags.modules.notifications.templates import my_event_email

if user.email:
    send_email(user.email, *my_event_email(param1=..., param2=...))
```

No registration, no config change, no router change required.

---

## Module Layout

```
backend/src/crags/modules/notifications/
├── __init__.py
├── service.py      send_email() — SMTP delivery or dev-mode logging
└── templates.py    password_reset_email, booking_confirmed_email, booking_preempted_email
```
