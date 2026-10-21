"""SQLAlchemy ORM models — MySQL compatible, CHAR(36) for UUIDs."""

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CHAR,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Table,
    TypeDecorator,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class UUIDType(TypeDecorator):
    """UUID stored as CHAR(36) — works with both Python UUID objects and strings."""
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return str(value)
        return value


def gen_uuid():
    return str(uuid.uuid4())


# ───────────── Association table: project ↔ members ─────────────

project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUIDType, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(20), nullable=False, default="member"),  # manager | member | viewer
)

# ───────────── Association table: task ↔ tags ─────────────

task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", UUIDType, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag", String(50), primary_key=True),
)


invitation_projects = Table(
    "invitation_projects",
    Base.metadata,
    Column("invitation_id", UUIDType, ForeignKey("invitations.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
)


# ───────────── User ─────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    initials = Column(String(10), nullable=False, default="")
    role = Column(String(50), nullable=False, default="")          # должность: "Frontend Dev", etc.
    system_role = Column(String(20), nullable=False, default="member")  # admin | manager | member
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")
    comments = relationship("Comment", back_populates="author")
    notifications = relationship("Notification", back_populates="user")


# ───────────── Project ─────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True, default="")
    status = Column(String(30), nullable=False, default="planning")
    priority = Column(String(20), nullable=False, default="medium")
    color = Column(String(7), nullable=False, default="#6C5CE7")
    deadline = Column(DateTime, nullable=True)
    progress = Column(Integer, nullable=False, default=0)
    owner_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    members = relationship("User", secondary=project_members, backref="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


# ───────────── Task ─────────────

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True, default="")
    brief = Column(Text, nullable=True, default="")        # ТЗ — техническое задание
    status = Column(String(20), nullable=False, default="todo")  # todo | in_progress | pending_review | rejected | done
    priority = Column(String(20), nullable=False, default="medium")
    due_date = Column(DateTime, nullable=True)
    project_id = Column(UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    assignee_id = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    created_by = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[created_by])
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")


# ───────────── Comment ─────────────

class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    content = Column(Text, nullable=False)
    task_id = Column(UUIDType, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUIDType, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")


# ───────────── Notification ─────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    user_id = Column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False, default="info")
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="notifications")


# ───────────── TaskAttachment ─────────────

class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    task_id = Column(UUIDType, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = Column(UUIDType, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    task = relationship("Task", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by])


# ───────────── Invitation ─────────────

def gen_invite_token():
    return secrets.token_urlsafe(32)


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    token = Column(String(64), unique=True, nullable=False, default=gen_invite_token, index=True)
    invite_type = Column(String(20), nullable=False, default="project")  # project | manager
    project_id = Column(UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)  # null для manager-invite
    role = Column(String(20), nullable=False, default="member")  # manager | member | viewer
    created_by = Column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=True)       # optional: restrict to specific email
    profession = Column(String(100), nullable=True)  # optional: frontend dev, backend dev, etc
    max_uses = Column(Integer, nullable=False, default=1)  # 0 = unlimited
    uses_count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", backref="invitations", foreign_keys=[project_id])
    projects = relationship("Project", secondary=invitation_projects)
    creator = relationship("User", foreign_keys=[created_by])


# ───────────── Activity ─────────────

class Activity(Base):
    __tablename__ = "activities"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    project_id = Column(UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(UUIDType, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(UUIDType, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)  # task_created, status_changed, comment_added, attachment_added
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")
    project = relationship("Project")
    task = relationship("Task")


# ───────────── ProjectFolder ─────────────

class ProjectFolder(Base):
    __tablename__ = "project_folders"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    project_id = Column(UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    parent_id = Column(UUIDType, ForeignKey("project_folders.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Realationships
    documents = relationship("ProjectDocument", back_populates="folder", cascade="all, delete-orphan")


# ───────────── ProjectDocument ─────────────

class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id = Column(UUIDType, primary_key=True, default=gen_uuid)
    project_id = Column(UUIDType, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(UUIDType, ForeignKey("project_folders.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(UUIDType, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    doc_type = Column(String(20), nullable=False, default="text")  # text | link | file
    file_url = Column(String(1000), nullable=True)
    external_url = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", backref="documents")
    folder = relationship("ProjectFolder", back_populates="documents")
    author = relationship("User")
