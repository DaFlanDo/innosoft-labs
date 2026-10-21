"""Role-based permission helpers for project access control.

System roles (users.system_role):
  admin   — полный доступ, создаёт проекты, приглашает менеджеров
  manager — прикреплён к проектам, управляет участниками и задачами
  member  — рядовой участник, работает с задачами в своих проектах

Project roles (project_members.role):
  manager (3) → viewer (1)
  manager | member | viewer

Воркфлоу задач:
  todo → in_progress → pending_review → done
                             ↓
                          rejected → in_progress
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, Project, project_members


# ─── Project role levels ───────────────────────────────

ROLE_LEVELS = {
    "viewer": 1,
    "member": 2,
    "manager": 3,
}


def is_admin(user: User) -> bool:
    return user.system_role == "admin"


def is_manager_or_admin(user: User) -> bool:
    return user.system_role in ("admin", "manager")


def role_level(role: str) -> int:
    return ROLE_LEVELS.get(role, 0)


# ─── Get user's role in a project ──────────────

async def get_project_role(db: AsyncSession, project_id: UUID, user: User) -> str | None:
    """Return user's role in a project, or None if not a member.
    Admin gets 'manager' equivalent access in all projects.
    """
    if is_admin(user):
        return "manager"

    result = await db.execute(
        select(project_members.c.role).where(
            project_members.c.project_id == str(project_id),
            project_members.c.user_id == str(user.id),
        )
    )
    row = result.one_or_none()
    return row[0] if row else None


# ─── Permission check (raises 403) ────────────

async def require_project_role(
    db: AsyncSession,
    project_id: UUID,
    user: User,
    min_role: str = "member",
) -> str:
    """Ensure user has at least `min_role` in the project.
    Returns the user's actual role. Raises 403 if insufficient.
    """
    actual_role = await get_project_role(db, project_id, user)

    if actual_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого проекта",
        )

    if role_level(actual_role) < role_level(min_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Недостаточно прав. Требуется роль: {min_role}, ваша: {actual_role}",
        )

    return actual_role


async def require_admin(user: User) -> None:
    """Ensure user is an admin. Raises 403 if not."""
    if not is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора",
        )


async def require_manager_or_admin(user: User) -> None:
    """Ensure user is a manager or admin. Raises 403 if not."""
    if not is_manager_or_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права менеджера или администратора",
        )


# ─── Permissions matrix helpers ────────────────

async def can_create_project(user: User) -> bool:
    """Only admins can create projects."""
    return is_admin(user)


async def can_delete_project(db: AsyncSession, project_id: UUID, user: User) -> bool:
    """Only admins can delete projects."""
    return is_admin(user)


async def can_manage_members(db: AsyncSession, project_id: UUID, user: User) -> bool:
    """Manager in project or admin can manage members."""
    if is_admin(user):
        return True
    role = await get_project_role(db, project_id, user)
    return role == "manager"


async def can_create_task(db: AsyncSession, project_id: UUID, user: User) -> bool:
    """Managers can create tasks (with TZ); members cannot create tasks."""
    if is_admin(user):
        return True
    role = await get_project_role(db, project_id, user)
    return role == "manager"


async def can_update_task(db: AsyncSession, project_id: UUID, user: User, task_assignee_id: str | None = None) -> bool:
    """Members can update status of their own tasks; managers can update any."""
    if is_admin(user):
        return True
    role = await get_project_role(db, project_id, user)
    if role == "manager":
        return True
    if role == "member" and task_assignee_id and str(task_assignee_id) == str(user.id):
        return True
    return False


async def can_approve_task(db: AsyncSession, project_id: UUID, user: User) -> bool:
    """Only managers and admins can approve/reject tasks."""
    if is_admin(user):
        return True
    role = await get_project_role(db, project_id, user)
    return role == "manager"
