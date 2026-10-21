"""add invitation_projects mapping

Revision ID: 006_invite_projects
Revises: 005_backfill_roles
Create Date: 2026-03-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_invite_projects"
down_revision: Union[str, None] = "005_backfill_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invitation_projects",
        sa.Column("invitation_id", sa.CHAR(36), sa.ForeignKey("invitations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("project_id", sa.CHAR(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("invitation_projects")
