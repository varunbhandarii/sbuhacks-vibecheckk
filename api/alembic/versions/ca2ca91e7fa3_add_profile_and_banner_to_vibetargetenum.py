"""Add profile and banner to VibeTargetEnum

Revision ID: ca2ca91e7fa3
Revises: 1713060d61a7
Create Date: 2025-11-08 20:39:21.513980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca2ca91e7fa3'
down_revision: Union[str, Sequence[str], None] = '1713060d61a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
