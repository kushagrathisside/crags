from sqlalchemy.orm import Session
from crags.modules.iam.models import User


def authenticate_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()