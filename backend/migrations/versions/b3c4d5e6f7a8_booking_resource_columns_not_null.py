"""booking resource columns not null

Revision ID: b3c4d5e6f7a8
Revises: 9f2f0ef4f0dd
Create Date: 2026-05-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "9f2f0ef4f0dd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RESOURCE_COLS = ("req_cpu", "req_gpu", "req_ram", "req_vram")


def upgrade() -> None:
    # Backfill any stale NULLs before tightening the constraint.
    op.execute(
        "UPDATE bookings SET req_cpu = 0 WHERE req_cpu IS NULL;"
        "UPDATE bookings SET req_gpu = 0 WHERE req_gpu IS NULL;"
        "UPDATE bookings SET req_ram = 0 WHERE req_ram IS NULL;"
        "UPDATE bookings SET req_vram = 0 WHERE req_vram IS NULL;"
    )
    for col in _RESOURCE_COLS:
        op.alter_column("bookings", col, nullable=False, existing_type=sa.Integer())


def downgrade() -> None:
    for col in _RESOURCE_COLS:
        op.alter_column("bookings", col, nullable=True, existing_type=sa.Integer())
