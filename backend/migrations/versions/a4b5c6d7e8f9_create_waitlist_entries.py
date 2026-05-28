"""Create waitlist_entries table

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-05-27 00:03:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("system_id", sa.Integer(), sa.ForeignKey("compute_systems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("req_cpu", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_gpu", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_ram", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_vram", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_hours", sa.Integer(), nullable=False),
        sa.Column("access_type", sa.String(20), nullable=False, server_default="FOREGROUND"),
        sa.Column("academic_category", sa.String(), nullable=True),
        sa.Column("project_title", sa.String(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="WAITING"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_waitlist_user_id", "waitlist_entries", ["user_id"])
    op.create_index("ix_waitlist_system_id", "waitlist_entries", ["system_id"])
    op.create_index("ix_waitlist_status_priority", "waitlist_entries", ["status", "priority"])


def downgrade() -> None:
    op.drop_index("ix_waitlist_status_priority", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_system_id", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_user_id", table_name="waitlist_entries")
    op.drop_table("waitlist_entries")
