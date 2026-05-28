"""Add approval fields to bookings and new audit actions

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-27 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("bookings", sa.Column("approved_at", sa.DateTime(), nullable=True))
    op.add_column("bookings", sa.Column("rejection_reason", sa.Text(), nullable=True))

    # Add BOOKING_APPROVED and BOOKING_REJECTED to audit_logs — no schema change needed
    # since action is stored as plain VARCHAR; enum values are extended in application code.


def downgrade() -> None:
    op.drop_column("bookings", "rejection_reason")
    op.drop_column("bookings", "approved_at")
    op.drop_column("bookings", "approved_by")
