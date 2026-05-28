"""Create system_costs table and add health fields to compute_systems

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-05-27 00:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add health-check fields to compute_systems
    op.add_column("compute_systems", sa.Column("health_check_url", sa.Text(), nullable=True))
    op.add_column("compute_systems", sa.Column("last_health_check_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("compute_systems", sa.Column("last_health_status", sa.String(20), nullable=True))

    # Cost rates per system
    op.create_table(
        "system_costs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_id", sa.Integer(), sa.ForeignKey("compute_systems.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("cpu_core_hour_rate", sa.Numeric(10, 4), nullable=False, server_default="0.0"),
        sa.Column("gpu_hour_rate", sa.Numeric(10, 4), nullable=False, server_default="0.0"),
        sa.Column("ram_gb_hour_rate", sa.Numeric(10, 4), nullable=False, server_default="0.0"),
        sa.Column("vram_gb_hour_rate", sa.Numeric(10, 4), nullable=False, server_default="0.0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("system_costs")
    op.drop_column("compute_systems", "last_health_status")
    op.drop_column("compute_systems", "last_health_check_at")
    op.drop_column("compute_systems", "health_check_url")
