"""Create booking_policies table

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-05-27 00:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, Sequence[str], None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        # Per-booking limits
        sa.Column("max_duration_hours", sa.Integer(), nullable=True),
        sa.Column("max_advance_days", sa.Integer(), nullable=True),
        sa.Column("max_concurrent_bookings", sa.Integer(), nullable=True),
        # Approval thresholds (NULL = never require approval)
        sa.Column("approval_required_above_gpu", sa.Integer(), nullable=True),
        sa.Column("approval_required_above_cpu", sa.Integer(), nullable=True),
        sa.Column("approval_required_above_ram_gb", sa.Integer(), nullable=True),
        sa.Column("approval_required_above_hours", sa.Integer(), nullable=True),
        # Always require approval regardless of resources
        sa.Column("always_require_approval", sa.Boolean(), nullable=False, server_default="false"),
        # Scope: NULL = global default; set to restrict by group
        sa.Column("group_id", sa.Integer(), sa.ForeignKey("groups.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_booking_policies_group_id", "booking_policies", ["group_id"])
    op.create_index("ix_booking_policies_is_default", "booking_policies", ["is_default"])


def downgrade() -> None:
    op.drop_index("ix_booking_policies_is_default", table_name="booking_policies")
    op.drop_index("ix_booking_policies_group_id", table_name="booking_policies")
    op.drop_table("booking_policies")
