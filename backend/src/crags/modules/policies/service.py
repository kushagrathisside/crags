"""
Policy Engine Service
=====================
Resolves the applicable BookingPolicy for a user/group, enforces hard limits,
and decides whether a booking requires admin approval.

Resolution order (first match wins):
  1. Policy scoped to the user's group
  2. Global default policy (is_default=True)
  3. No restrictions (all None)
"""
from __future__ import annotations

from datetime import timezone
from typing import Optional

from sqlalchemy.orm import Session

from crags.modules.policies.models import BookingPolicy
from crags.modules.policies.schemas import PolicyCheckResult, PolicyCreate, PolicyOut, PolicyUpdate
from crags.modules.audit.models import AuditAction
from crags.modules.audit.service import emit_audit


def get_policy_for_group(db: Session, group_id: Optional[int]) -> Optional[BookingPolicy]:
    if group_id:
        p = db.query(BookingPolicy).filter(BookingPolicy.group_id == group_id).first()
        if p:
            return p
    return db.query(BookingPolicy).filter(BookingPolicy.is_default.is_(True)).first()


def check_booking_policy(
    db: Session,
    *,
    group_id: Optional[int],
    req_cpu: int,
    req_gpu: int,
    req_ram: int,
    duration_hours: float,
    advance_days: float,
    current_booking_count: int,
) -> PolicyCheckResult:
    policy = get_policy_for_group(db, group_id)
    violations: list[str] = []
    requires_approval = False

    if policy is None:
        return PolicyCheckResult(requires_approval=False, violations=[])

    if policy.max_duration_hours and duration_hours > policy.max_duration_hours:
        violations.append(f"Duration {duration_hours:.1f}h exceeds policy limit of {policy.max_duration_hours}h")

    if policy.max_advance_days and advance_days > policy.max_advance_days:
        violations.append(f"Booking starts {advance_days:.1f} days in advance; policy limit is {policy.max_advance_days} days")

    if policy.max_concurrent_bookings and current_booking_count >= policy.max_concurrent_bookings:
        violations.append(f"You already have {current_booking_count} active booking(s); policy limit is {policy.max_concurrent_bookings}")

    # Approval checks (soft — don't block, just route to REQUESTED)
    if policy.always_require_approval:
        requires_approval = True
    if policy.approval_required_above_gpu is not None and req_gpu > policy.approval_required_above_gpu:
        requires_approval = True
    if policy.approval_required_above_cpu is not None and req_cpu > policy.approval_required_above_cpu:
        requires_approval = True
    if policy.approval_required_above_ram_gb is not None and req_ram > policy.approval_required_above_ram_gb:
        requires_approval = True
    if policy.approval_required_above_hours is not None and duration_hours > policy.approval_required_above_hours:
        requires_approval = True

    return PolicyCheckResult(requires_approval=requires_approval, violations=violations)


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_policy(db: Session, payload: PolicyCreate, actor_user_id: Optional[int] = None) -> BookingPolicy:
    if payload.is_default:
        db.query(BookingPolicy).filter(BookingPolicy.is_default.is_(True)).update({"is_default": False})
    policy = BookingPolicy(**payload.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    emit_audit(db, AuditAction.POLICY_CREATED, policy.id, actor_user_id)
    return policy


def list_policies(db: Session) -> list[BookingPolicy]:
    return db.query(BookingPolicy).order_by(BookingPolicy.is_default.desc(), BookingPolicy.id).all()


def get_policy(db: Session, policy_id: int) -> Optional[BookingPolicy]:
    return db.query(BookingPolicy).filter(BookingPolicy.id == policy_id).first()


def update_policy(db: Session, policy_id: int, payload: PolicyUpdate, actor_user_id: Optional[int] = None) -> Optional[BookingPolicy]:
    policy = get_policy(db, policy_id)
    if not policy:
        return None
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        db.query(BookingPolicy).filter(BookingPolicy.is_default.is_(True), BookingPolicy.id != policy_id).update({"is_default": False})
    for k, v in data.items():
        setattr(policy, k, v)
    db.commit()
    db.refresh(policy)
    emit_audit(db, AuditAction.POLICY_UPDATED, policy.id, actor_user_id)
    return policy


def delete_policy(db: Session, policy_id: int, actor_user_id: Optional[int] = None) -> bool:
    policy = get_policy(db, policy_id)
    if not policy:
        return False
    db.delete(policy)
    db.commit()
    emit_audit(db, AuditAction.POLICY_DELETED, policy_id, actor_user_id)
    return True
