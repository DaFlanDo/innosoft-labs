"""add system roles, task brief, invitation type

Revision ID: 004_roles_brief_invite_type
Revises: 003_task_attachments
Create Date: 2026-03-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_roles_brief_invite_type"
down_revision: Union[str, None] = "003_task_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("system_role", sa.String(length=20), nullable=False, server_default="member"),
    )

    op.add_column(
        "tasks",
        sa.Column("brief", sa.Text(), nullable=True),
    )

    op.add_column(
        "invitations",
        sa.Column("invite_type", sa.String(length=20), nullable=False, server_default="project"),
    )

    op.alter_column(
        "invitations",
        "project_id",
        existing_type=sa.CHAR(length=36),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "invitations",
        "project_id",
        existing_type=sa.CHAR(length=36),
        nullable=False,
    )

    op.drop_column("invitations", "invite_type")
    op.drop_column("tasks", "brief")
    op.drop_column("users", "system_role")
