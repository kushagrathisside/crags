from fastapi import APIRouter

from crags.modules.iam.router import router as auth_router
from crags.modules.resources.router import router as systems_router
from crags.modules.scheduling.router import router as booking_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(systems_router)
router.include_router(booking_router)