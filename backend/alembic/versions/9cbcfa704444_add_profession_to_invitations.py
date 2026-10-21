"""add profession to invitations

Revision ID: 9cbcfa704444
Revises: 006_invite_projects
Create Date: 2026-03-21 11:10:33.439930

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9cbcfa704444'
down_revision: Union[str, None] = '006_invite_projects'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invitations', sa.Column('profession', sa.String(length=100), nullable=True))

def downgrade() -> None:
    op.drop_column('invitations', 'profession')
