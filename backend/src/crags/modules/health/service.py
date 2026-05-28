"""
System Health Monitor
=====================
Pings each ComputeSystem's health_check_url (if set) and updates
last_health_check_at / last_health_status accordingly.

Status values stored in last_health_status:
  UP   — HTTP 2xx within timeout
  DOWN — HTTP non-2xx or connection error
  SKIP — no health_check_url configured

The reconciler calls run_health_checks() on its interval. Systems that go DOWN
are automatically transitioned to MAINTENANCE and restored to ACTIVE when UP.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError

from sqlalchemy.orm import Session

from crags.modules.resources.models import ComputeSystem, SystemStatus

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 5


def _check_url(url: str) -> str:
    try:
        with urlopen(url, timeout=_TIMEOUT_SECONDS) as resp:
            return "UP" if 200 <= resp.status < 300 else "DOWN"
    except URLError:
        return "DOWN"
    except Exception:
        return "DOWN"


def run_health_checks(db: Session) -> dict[int, str]:
    """Check all systems with a health_check_url. Returns {system_id: status}."""
    systems = db.query(ComputeSystem).filter(ComputeSystem.health_check_url.isnot(None)).all()
    results: dict[int, str] = {}

    for system in systems:
        url = system.health_check_url
        if not url:
            continue
        status = _check_url(url)
        results[system.id] = status
        system.last_health_check_at = datetime.now(timezone.utc)
        system.last_health_status = status

        # Auto-transition DOWN → MAINTENANCE (only if currently ACTIVE)
        if status == "DOWN" and system.status == SystemStatus.ACTIVE:
            system.status = SystemStatus.MAINTENANCE
            logger.warning("System %s (%d) went DOWN — set MAINTENANCE", system.name, system.id)

        # Restore MAINTENANCE → ACTIVE if health is UP and not in a scheduled maintenance window
        if status == "UP" and system.status == SystemStatus.MAINTENANCE:
            # Don't restore if a scheduled maintenance window is still active
            from datetime import datetime as dt
            now = dt.now(timezone.utc)
            from crags.modules.maintenance.models import MaintenanceWindow
            active_window = (
                db.query(MaintenanceWindow)
                .filter(
                    MaintenanceWindow.system_id == system.id,
                    MaintenanceWindow.start_time <= now,
                    MaintenanceWindow.end_time > now,
                )
                .first()
            )
            if not active_window:
                system.status = SystemStatus.ACTIVE
                logger.info("System %s (%d) is UP — restored to ACTIVE", system.name, system.id)

    db.commit()

    # Any status change invalidates the cached systems list.
    if results:
        from crags.core.cache import KEY_SYSTEMS, get_cache
        get_cache().delete(KEY_SYSTEMS)

    return results


def get_system_health(db: Session, system_id: Optional[int] = None) -> list[dict]:
    q = db.query(ComputeSystem)
    if system_id:
        q = q.filter(ComputeSystem.id == system_id)
    systems = q.all()
    return [
        {
            "system_id": s.id,
            "system_name": s.name,
            "health_check_url": s.health_check_url,
            "last_health_check_at": s.last_health_check_at.isoformat() if s.last_health_check_at else None,
            "last_health_status": s.last_health_status or "SKIP",
            "system_status": s.status.value,
        }
        for s in systems
    ]
