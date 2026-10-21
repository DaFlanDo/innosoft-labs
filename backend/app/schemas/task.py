"""Task schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from pydantic import field_validator


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    brief: str = ""
    status: Literal["todo", "in_progress", "pending_review", "rejected", "done"] = "todo"
    priority: str = "medium"
    due_date: datetime | None = None
    project_id: UUID | None = None
    assignee_id: UUID | None = None
    tags: list[str] = []


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    brief: str | None = None
    status: Literal["todo", "in_progress", "pending_review", "rejected", "done"] | None = None
    priority: str | None = None
    due_date: datetime | None = None
    project_id: UUID | None = None
    assignee_id: UUID | None = None
    tags: list[str] | None = None


class TaskOut(BaseModel):
    id: UUID
    title: str
    description: str | None = ""
    brief: str | None = ""
    status: Literal["todo", "in_progress", "pending_review", "rejected", "done"]

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: str) -> str:
        if v == "progress":
            return "in_progress"
        return v

    priority: str
    due_date: datetime | None
    project_id: UUID | None
    assignee_id: UUID | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime | None
    tags: list[str] = []
    project_name: str | None = None
    assignee_name: str | None = None
    assignee_initials: str | None = None

    model_config = {"from_attributes": True}


class RejectBody(BaseModel):
    comment: str = ""   # необязательный комментарий при возврате задачи


class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: UUID
    content: str
    task_id: UUID
    author_id: UUID
    author_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentOut(BaseModel):
    id: UUID
    task_id: UUID
    uploaded_by: UUID | None
    uploader_name: str | None = None
    file_name: str
    file_url: str
    file_size: int | None
    mime_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
