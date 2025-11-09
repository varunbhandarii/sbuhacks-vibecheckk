"""Add profile and banner to VibeTargetEnum

Revision ID: 1713060d61a7
Revises: 0922e24544c8
Create Date: 2025-11-08 20:36:39.143232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1713060d61a7'
down_revision: Union[str, Sequence[str], None] = '0922e24544c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
