"""Contexual Vibe questions

Revision ID: 95c96c821d74
Revises: b5398f600c67
Create Date: 2025-11-08 21:48:59.208932

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95c96c821d74'
down_revision: Union[str, Sequence[str], None] = 'b5398f600c67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
