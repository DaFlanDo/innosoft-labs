"""Add description to tasks and task_attachments table

Revision ID: 003_task_attachments
Revises: 002_invitations
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = "003_task_attachments"
down_revision = "002_invitations"
branch_labels = None
depends_on = None


def upgrade():
    # Add description column to tasks
    op.add_column("tasks", sa.Column("description", sa.Text(), nullable=True))

    # Create task_attachments table
    op.create_table(
        "task_attachments",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("task_id", sa.CHAR(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploaded_by", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(1000), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("task_attachments")
    op.drop_column("tasks", "description")
