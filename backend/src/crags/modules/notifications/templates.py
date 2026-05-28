"""
Plain-text email templates. Each function returns (subject, body).
No external templating engine — plain string formatting only.
"""

from __future__ import annotations


def password_reset_email(reset_url: str) -> tuple[str, str]:
    subject = "CRAGS — Password reset request"
    body = f"""\
You requested a password reset for your CRAGS account.

Click the link below to set a new password. The link expires in 60 minutes
and can only be used once.

  {reset_url}

If you did not request this reset, you can safely ignore this email.
Your password will not change until you follow the link above.

— CRAGS
"""
    return subject, body


def booking_confirmed_email(
    *,
    username: str,
    system_name: str,
    start_time: str,
    end_time: str,
    req_cpu: int,
    req_gpu: int,
    req_ram: int,
    req_vram: int,
    booking_id: int,
) -> tuple[str, str]:
    subject = f"CRAGS — Booking #{booking_id} confirmed on {system_name}"
    body = f"""\
Hi {username},

Your resource booking has been confirmed.

  System   : {system_name}
  Window   : {start_time} → {end_time}
  CPU      : {req_cpu} cores
  GPU      : {req_gpu} units
  RAM      : {req_ram} GB
  VRAM     : {req_vram} GB
  Booking  : #{booking_id}

You can view or cancel this booking in the CRAGS portal.

— CRAGS
"""
    return subject, body


def booking_preempted_email(
    *,
    username: str,
    system_name: str,
    start_time: str,
    end_time: str,
    booking_id: int,
) -> tuple[str, str]:
    subject = f"CRAGS — Booking #{booking_id} preempted on {system_name}"
    body = f"""\
Hi {username},

Your background booking has been preempted to free capacity for a foreground job.

  System   : {system_name}
  Window   : {start_time} → {end_time}
  Booking  : #{booking_id}

You can submit a new booking request in the CRAGS portal at any time.

— CRAGS
"""
    return subject, body
