"""adding audit table

Revision ID: 18818d333a7e
Revises: e8be5520f683
Create Date: 2026-03-04 16:45:17.241948

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18818d333a7e'
down_revision: Union[str, Sequence[str], None] = 'e8be5520f683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():

    op.create_table(
        "audit_logs",

        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("table_name", sa.String(), nullable=False),

        sa.Column("record_id", sa.Integer(), nullable=False),

        sa.Column("action", sa.String(), nullable=False),

        sa.Column("timestamp", sa.DateTime(), nullable=False),

        sa.Column("user_id", sa.Integer(), nullable=True)
    )


def downgrade():

    op.drop_table("audit_logs")