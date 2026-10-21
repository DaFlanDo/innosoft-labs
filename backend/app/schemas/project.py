"""Project schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "planning"
    priority: str = "medium"
    color: str = "#6C5CE7"
    deadline: datetime | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    color: str | None = None
    deadline: datetime | None = None
    progress: int | None = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str
    status: str
    priority: str
    color: str
    deadline: datetime | None
    progress: int
    owner_id: UUID | None
    created_at: datetime
    updated_at: datetime | None
    tasks_count: int = 0
    members_count: int = 0

    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    user_id: UUID
    role: str = "member"


class MemberOut(BaseModel):
    user_id: UUID
    name: str
    initials: str
    system_role: str | None = None
    role: str
    profession: str | None = None

    model_config = {"from_attributes": True}
