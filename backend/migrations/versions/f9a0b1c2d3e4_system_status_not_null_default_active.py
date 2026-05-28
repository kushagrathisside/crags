"""system_status_not_null_default_active

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-05-28

"""
from alembic import op

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill any remaining NULLs (safe to run even if already backfilled)
    op.execute("UPDATE compute_systems SET status = 'ACTIVE' WHERE status IS NULL")
    # Apply NOT NULL + server default
    op.execute("ALTER TABLE compute_systems ALTER COLUMN status SET DEFAULT 'ACTIVE'")
    op.execute("ALTER TABLE compute_systems ALTER COLUMN status SET NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE compute_systems ALTER COLUMN status DROP NOT NULL")
    op.execute("ALTER TABLE compute_systems ALTER COLUMN status DROP DEFAULT")
