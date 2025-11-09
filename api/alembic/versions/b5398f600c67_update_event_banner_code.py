"""Update Event Banner Code

Revision ID: b5398f600c67
Revises: ca2ca91e7fa3
Create Date: 2025-11-08 20:50:04.445128

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5398f600c67'
down_revision: Union[str, Sequence[str], None] = 'ca2ca91e7fa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
