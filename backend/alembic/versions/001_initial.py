"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("initials", sa.String(10), nullable=False, server_default=""),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # Projects
    op.create_table(
        "projects",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True, server_default=""),
        sa.Column("status", sa.String(30), nullable=False, server_default="planning"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6C5CE7"),
        sa.Column("deadline", sa.DateTime, nullable=True),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("owner_id", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # Project members (many-to-many)
    op.create_table(
        "project_members",
        sa.Column("project_id", sa.CHAR(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
    )

    # Tasks
    op.create_table(
        "tasks",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("due_date", sa.DateTime, nullable=True),
        sa.Column("project_id", sa.CHAR(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("assignee_id", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # Task tags
    op.create_table(
        "task_tags",
        sa.Column("task_id", sa.CHAR(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag", sa.String(50), primary_key=True),
    )

    # Comments
    op.create_table(
        "comments",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("task_id", sa.CHAR(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.CHAR(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # Notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="info"),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("comments")
    op.drop_table("task_tags")
    op.drop_table("tasks")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("users")
