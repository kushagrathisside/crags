from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crags.db.session import get_db
from crags.modules.iam.auth_service import authenticate_user
from crags.modules.iam.schemas import LoginRequest, TokenResponse
from crags.core.security import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = authenticate_user(db, data.username)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.username})

    return {"access_token": token}