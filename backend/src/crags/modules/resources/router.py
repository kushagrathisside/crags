from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.resources.service import create_system, list_systems
from crags.modules.resources.schemas import SystemCreate, SystemResponse

router = APIRouter(
    prefix="/api/v1/systems",
    tags=["systems"]
)


@router.post("/", response_model=SystemResponse)
def add_system(data: SystemCreate, db: Session = Depends(get_db)):
    return create_system(db, data)


@router.get("/", response_model=list[SystemResponse])
def get_systems(db: Session = Depends(get_db)):
    return list_systems(db)