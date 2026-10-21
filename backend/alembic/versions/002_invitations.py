"""add invitations table

Revision ID: 002_invitations
Revises: 001_initial
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_invitations"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("token", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("project_id", sa.CHAR(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("created_by", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("max_uses", sa.Integer, nullable=False, server_default="1"),
        sa.Column("uses_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("invitations")
