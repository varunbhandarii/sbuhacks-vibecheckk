"""roll back

Revision ID: 646e1995ed7d
Revises: 95c96c821d74
Create Date: 2025-11-08 21:56:24.190302

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '646e1995ed7d'
down_revision: Union[str, Sequence[str], None] = '95c96c821d74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
