"""Create booking_templates table

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-05-27 00:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("system_id", sa.Integer(), sa.ForeignKey("compute_systems.id", ondelete="SET NULL"), nullable=True),
        sa.Column("req_cpu", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_gpu", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_ram", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("req_vram", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_hours", sa.Integer(), nullable=True),
        sa.Column("access_type", sa.String(20), nullable=False, server_default="FOREGROUND"),
        sa.Column("academic_category", sa.String(), nullable=True),
        sa.Column("project_title", sa.String(), nullable=True),
        sa.Column("expected_deliverable", sa.Text(), nullable=True),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_booking_templates_user_id", "booking_templates", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_templates_user_id", table_name="booking_templates")
    op.drop_table("booking_templates")
