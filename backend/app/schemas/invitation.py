"""Invitation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class InvitationCreate(BaseModel):
    """Создание инвайта в проект (менеджер → участник)."""
    role: str = "member"             # member | viewer | manager
    email: str | None = None         # optional: restrict to email
    profession: str | None = None    # optional: e.g. "Frontend dev"
    max_uses: int = 1                # 0 = unlimited
    expires_in_days: int = 7


class ManagerInviteCreate(BaseModel):
    """Создание инвайта для менеджера (admin → manager). Без привязки к проекту."""
    email: str | None = None
    profession: str | None = None
    max_uses: int = 1
    expires_in_days: int = 7
    project_ids: list[UUID] = []
    system_role: str = "manager"


class InvitationOut(BaseModel):
    id: UUID
    token: str
    invite_type: str                 # project | manager
    project_id: UUID | None          # None для manager-invite
    project_ids: list[UUID] = []
    role: str
    created_by: UUID
    email: str | None
    profession: str | None
    max_uses: int
    uses_count: int
    expires_at: datetime
    is_active: bool
    created_at: datetime
    invite_url: str | None = None    # populated by API layer

    model_config = {"from_attributes": True}


class InviteInfo(BaseModel):
    """Public info shown when someone opens an invite link."""
    invite_type: str                 # project | manager
    project_name: str | None         # None для manager-invite
    project_names: list[str] = []
    project_color: str | None        # None для manager-invite
    invited_email: str | None = None
    role: str
    profession: str | None = None
    created_by_name: str
    is_valid: bool
    message: str | None = None


class InviteRegister(BaseModel):
    """Register + accept invite in one step."""
    name: str
    email: str | None = None
    password: str
    initials: str | None = None
