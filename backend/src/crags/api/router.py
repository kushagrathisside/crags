from fastapi import APIRouter

from crags.modules.audit.router import router as audit_router
from crags.modules.iam.router import router as iam_router
from crags.modules.resources.router import router as systems_router
from crags.modules.scheduling.router import router as booking_router

router = APIRouter()

router.include_router(iam_router)
router.include_router(systems_router)
router.include_router(booking_router)
router.include_router(audit_router)
