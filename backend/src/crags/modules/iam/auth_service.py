from sqlalchemy.orm import Session
from crags.modules.iam.models import User
from crags.modules.iam.service import authenticate_user as authenticate_by_identifier


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    return authenticate_by_identifier(db, identifier, password)
