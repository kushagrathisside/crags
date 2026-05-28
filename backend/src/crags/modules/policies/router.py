from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from crags.core.cache import KEY_POLICIES, TTL_POLICIES, get_cache
from crags.db.session import get_db
from crags.modules.iam.dependencies import require_admin, get_current_user
from crags.modules.iam.models import User
from crags.modules.policies import service
from crags.modules.policies.schemas import PolicyCreate, PolicyOut, PolicyUpdate

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("", response_model=list[PolicyOut])
def list_policies(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    hit = get_cache().get(KEY_POLICIES)
    if hit is not None:
        return hit
    result = service.list_policies(db)
    get_cache().set(KEY_POLICIES, jsonable_encoder(result), ttl=TTL_POLICIES)
    return result


@router.post("", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
def create_policy(
    payload: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = service.create_policy(db, payload, actor_user_id=current_user.id)
    get_cache().delete(KEY_POLICIES)
    return result


@router.get("/{policy_id}", response_model=PolicyOut)
def get_policy(policy_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = service.get_policy(db, policy_id)
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    return p


@router.patch("/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: int,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    p = service.update_policy(db, policy_id, payload, actor_user_id=current_user.id)
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    get_cache().delete(KEY_POLICIES)
    return p


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not service.delete_policy(db, policy_id, actor_user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Policy not found")
    get_cache().delete(KEY_POLICIES)
