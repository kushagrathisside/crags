from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from crags.api.router import router
from crags.core.config import settings
from crags.db.session import SessionLocal
from crags.modules.iam.service import ensure_super_admin

app = FastAPI(
    title="CRAGS API",
    version="0.1.0"
)


@app.get("/healthz", tags=["system"])
def healthz():
    return {"status": "ok"}


@app.on_event("startup")
def seed_super_admin():
    db: Session = SessionLocal()
    try:
        ensure_super_admin(db)
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
