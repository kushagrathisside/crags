"""bookings user_id system_id not null and indexes

Revision ID: d1e2f3a4b5c6
Revises: c7d8e9f0a1b2
Create Date: 2026-05-26 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop any orphaned rows before tightening FK-backed columns.
    op.execute(
        "DELETE FROM bookings WHERE user_id IS NULL OR system_id IS NULL;"
    )

    op.alter_column("bookings", "user_id", nullable=False, existing_type=sa.Integer())
    op.alter_column("bookings", "system_id", nullable=False, existing_type=sa.Integer())

    op.create_index("ix_bookings_user_id", "bookings", ["user_id"])
    op.create_index("ix_bookings_system_id", "bookings", ["system_id"])


def downgrade() -> None:
    op.drop_index("ix_bookings_system_id", table_name="bookings")
    op.drop_index("ix_bookings_user_id", table_name="bookings")

    op.alter_column("bookings", "system_id", nullable=True, existing_type=sa.Integer())
    op.alter_column("bookings", "user_id", nullable=True, existing_type=sa.Integer())
