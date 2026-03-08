from sqlalchemy.orm import Session
from crags.modules.resources.models import ComputeSystem


def create_system(db: Session, data):
    system = ComputeSystem(**data.dict())
    db.add(system)
    db.commit()
    db.refresh(system)
    return system


def list_systems(db: Session):
    return db.query(ComputeSystem).all()