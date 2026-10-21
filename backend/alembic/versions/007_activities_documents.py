"""activities and project documents

Таблицы activities, project_folders и project_documents были в моделях,
но не в миграциях — создавались только через create_all на старте.

Revision ID: 007_activities_documents
Revises: 9cbcfa704444
Create Date: 2026-10-21 15:40:57.682240

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.models import UUIDType


# revision identifiers, used by Alembic.
revision: str = '007_activities_documents'
down_revision: Union[str, None] = '9cbcfa704444'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('project_folders',
    sa.Column('id', UUIDType(length=36), nullable=False),
    sa.Column('project_id', UUIDType(length=36), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('parent_id', UUIDType(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['parent_id'], ['project_folders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('activities',
    sa.Column('id', UUIDType(length=36), nullable=False),
    sa.Column('project_id', UUIDType(length=36), nullable=True),
    sa.Column('task_id', UUIDType(length=36), nullable=True),
    sa.Column('user_id', UUIDType(length=36), nullable=False),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('project_documents',
    sa.Column('id', UUIDType(length=36), nullable=False),
    sa.Column('project_id', UUIDType(length=36), nullable=False),
    sa.Column('folder_id', UUIDType(length=36), nullable=True),
    sa.Column('author_id', UUIDType(length=36), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('doc_type', sa.String(length=20), nullable=False),
    sa.Column('file_url', sa.String(length=1000), nullable=True),
    sa.Column('external_url', sa.String(length=1000), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['folder_id'], ['project_folders.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.drop_constraint('invitations_ibfk_2', 'invitations', type_='foreignkey')
    op.create_foreign_key('fk_invitations_created_by', 'invitations', 'users', ['created_by'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_invitations_created_by', 'invitations', type_='foreignkey')
    op.create_foreign_key('invitations_ibfk_2', 'invitations', 'users', ['created_by'], ['id'])
    op.drop_table('project_documents')
    op.drop_table('activities')
    op.drop_table('project_folders')
