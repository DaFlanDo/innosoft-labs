"""backfill system roles and normalize project member roles

Revision ID: 005_backfill_roles
Revises: 004_roles_brief_invite_type
Create Date: 2026-03-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_backfill_roles"
down_revision: Union[str, None] = "004_roles_brief_invite_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        UPDATE users
        SET system_role = 'admin'
        WHERE email = 'a.kozlov@innosoft.dev'
    """))

    conn.execute(sa.text("""
        UPDATE users
        SET system_role = 'manager'
        WHERE system_role = 'member'
          AND (
            LOWER(COALESCE(`role`, '')) LIKE '%manager%'
            OR LOWER(COALESCE(`role`, '')) LIKE '%менеджер%'
            OR LOWER(COALESCE(`role`, '')) LIKE '%руковод%'
          )
    """))

    conn.execute(sa.text("""
        UPDATE project_members
        SET `role` = 'manager'
        WHERE `role` = 'owner'
    """))


def downgrade() -> None:
    # Data backfill is intentionally non-reversible.
    pass
