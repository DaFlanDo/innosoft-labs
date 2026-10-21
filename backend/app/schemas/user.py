"""User schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    initials: str
    role: str
    system_role: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    initials: str | None = None
    role: str | None = None


class UserSystemRoleUpdate(BaseModel):
    system_role: str | None = None
    role: str | None = None


class UserStats(BaseModel):
    total_tasks: int
    todo: int
    in_progress: int
    done: int
    projects_count: int
