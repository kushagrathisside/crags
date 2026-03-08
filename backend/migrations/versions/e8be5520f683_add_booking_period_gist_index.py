"""add booking_period gist index

Revision ID: e8be5520f683
Revises: 3ec7eac7aa72
Create Date: 2026-03-04 16:42:30.623106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8be5520f683'
down_revision: Union[str, Sequence[str], None] = '3ec7eac7aa72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute(
        "CREATE INDEX booking_period_gist_idx "
        "ON bookings USING GIST (booking_period);"
    )


def downgrade():
    op.execute(
        "DROP INDEX booking_period_gist_idx;"
    )
