from fastapi import APIRouter

from crags.modules.analytics.router import router as analytics_router
from crags.modules.audit.router import router as audit_router
from crags.modules.billing.router import router as billing_router
from crags.modules.health.router import router as health_router
from crags.modules.iam.router import router as iam_router
from crags.modules.maintenance.router import router as maintenance_router
from crags.modules.policies.router import router as policies_router
from crags.modules.resources.router import router as systems_router
from crags.modules.scheduling.router import router as booking_router
from crags.modules.templates.router import router as templates_router
from crags.modules.waitlist.router import router as waitlist_router
from crags.modules.webhooks.router import router as webhooks_router

router = APIRouter()

router.include_router(iam_router)
router.include_router(systems_router)
router.include_router(booking_router)
router.include_router(audit_router)

# New modules — all mounted under /api/v1/
_V1 = "/api/v1"
router.include_router(analytics_router, prefix=_V1)
router.include_router(billing_router, prefix=_V1)
router.include_router(health_router, prefix=_V1)
router.include_router(maintenance_router, prefix=_V1)
router.include_router(policies_router, prefix=_V1)
router.include_router(templates_router, prefix=_V1)
router.include_router(waitlist_router, prefix=_V1)
router.include_router(webhooks_router, prefix=_V1)
