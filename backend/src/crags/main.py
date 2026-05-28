import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from crags.api.router import router
from crags.core.config import settings
from crags.db.session import SessionLocal
from crags.modules.iam.service import ensure_super_admin

logger = logging.getLogger(__name__)

_INSECURE_JWT_SECRET = "dev-secret"

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="CRAGS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# ---------------------------------------------------------------------------
# Scheduler (single global instance — one set of jobs per process)
# ---------------------------------------------------------------------------

_scheduler = BackgroundScheduler(
    daemon=True,
    job_defaults={
        "coalesce": True,       # skip missed fires, run once when back
        "max_instances": 1,     # never overlap with itself
        "misfire_grace_time": 60,
    },
)


def _run_reconcile() -> None:
    """Adapter: opens a DB session, runs all reconciliation tasks, closes the session."""
    db: Session = SessionLocal()
    try:
        from crags.modules.scheduling.cron import reconcile_bookings
        reconcile_bookings(db)
    except Exception:
        logger.exception("reconcile_bookings failed")
    finally:
        db.close()

    db = SessionLocal()
    try:
        from crags.modules.maintenance.service import apply_maintenance_transitions
        apply_maintenance_transitions(db)
    except Exception:
        logger.exception("apply_maintenance_transitions failed")
    finally:
        db.close()

    db = SessionLocal()
    try:
        from crags.modules.waitlist.service import promote_eligible
        promoted = promote_eligible(db)
        if promoted:
            logger.info("Promoted %d waitlist entries to bookings", promoted)
    except Exception:
        logger.exception("promote_eligible failed")
    finally:
        db.close()

    db = SessionLocal()
    try:
        from crags.modules.health.service import run_health_checks
        run_health_checks(db)
    except Exception:
        logger.exception("run_health_checks failed")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Security checks
# ---------------------------------------------------------------------------

def _check_security_settings() -> None:
    is_production = settings.APP_ENV.lower() == "production"
    issues: list[str] = []

    if settings.JWT_SECRET_KEY == _INSECURE_JWT_SECRET:
        issues.append("JWT_SECRET_KEY is the default dev-secret — rotate before production")
    if not settings.AUTH_COOKIE_SECURE:
        issues.append("AUTH_COOKIE_SECURE is False — set True when serving over HTTPS")

    if issues:
        msg = "Security configuration issues:\n" + "\n".join(f"  • {i}" for i in issues)
        if is_production:
            raise RuntimeError(msg)
        logger.warning(msg)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    _check_security_settings()

    db: Session = SessionLocal()
    try:
        ensure_super_admin(db)
    finally:
        db.close()

    _scheduler.add_job(
        _run_reconcile,
        trigger="interval",
        minutes=settings.RECONCILE_INTERVAL_MINUTES,
        id="reconcile_bookings",
        replace_existing=True,
        # Fire immediately on startup so state is always fresh after a restart.
        next_run_time=datetime.now(timezone.utc),
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — reconcile_bookings every %d min",
        settings.RECONCILE_INTERVAL_MINUTES,
    )


@app.on_event("shutdown")
def on_shutdown() -> None:
    _scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["system"])
def healthz():
    job = _scheduler.get_job("reconcile_bookings")
    return {
        "status": "ok",
        "scheduler": {
            "running": _scheduler.running,
            "next_reconcile": job.next_run_time.isoformat() if job and job.next_run_time else None,
        },
    }
