"""expand iam and group quotas

Revision ID: 9f2f0ef4f0dd
Revises: 18818d333a7e
Create Date: 2026-04-11 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f2f0ef4f0dd"
down_revision: Union[str, Sequence[str], None] = "18818d333a7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("concurrent_cpu_quota", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("concurrent_gpu_quota", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("concurrent_ram_quota", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("concurrent_vram_quota", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("monthly_cpu_hours_quota", sa.Float(), nullable=True))
    op.add_column("groups", sa.Column("monthly_gpu_hours_quota", sa.Float(), nullable=True))
    op.add_column("groups", sa.Column("monthly_ram_gb_hours_quota", sa.Float(), nullable=True))
    op.add_column("groups", sa.Column("monthly_vram_gb_hours_quota", sa.Float(), nullable=True))

    op.add_column("users", sa.Column("email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("users", sa.Column("auth_provider", sa.String(), server_default="local", nullable=False))
    op.add_column("users", sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False))
    op.add_column("users", sa.Column("last_login", sa.DateTime(), nullable=True))
    op.create_unique_constraint("uq_users_email", "users", ["email"])

    op.alter_column("users", "is_active", server_default=None)
    op.alter_column("users", "auth_provider", server_default=None)
    op.alter_column("users", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "last_login")
    op.drop_column("users", "created_at")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "is_active")
    op.drop_column("users", "hashed_password")
    op.drop_column("users", "email")

    op.drop_column("groups", "monthly_vram_gb_hours_quota")
    op.drop_column("groups", "monthly_ram_gb_hours_quota")
    op.drop_column("groups", "monthly_gpu_hours_quota")
    op.drop_column("groups", "monthly_cpu_hours_quota")
    op.drop_column("groups", "concurrent_vram_quota")
    op.drop_column("groups", "concurrent_ram_quota")
    op.drop_column("groups", "concurrent_gpu_quota")
    op.drop_column("groups", "concurrent_cpu_quota")
