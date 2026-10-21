"""User service — business logic for users."""

from uuid import UUID

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, Task
from app.schemas.user import UserUpdate


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.name))
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user_id: UUID, data: UserUpdate) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.flush()
    return user


async def get_user_stats(db: AsyncSession, user_id: UUID) -> dict:
    """Get task statistics for a user."""
    total = await db.execute(
        select(func.count()).select_from(Task).where(Task.assignee_id == user_id)
    )
    todo = await db.execute(
        select(func.count()).select_from(Task).where(Task.assignee_id == user_id, Task.status == "todo")
    )
    progress = await db.execute(
        select(func.count()).select_from(Task).where(Task.assignee_id == user_id, Task.status == "progress")
    )
    done = await db.execute(
        select(func.count()).select_from(Task).where(Task.assignee_id == user_id, Task.status == "done")
    )
    projects = await db.execute(
        select(func.count(func.distinct(Task.project_id))).select_from(Task).where(Task.assignee_id == user_id)
    )

    return {
        "total_tasks": total.scalar() or 0,
        "todo": todo.scalar() or 0,
        "in_progress": progress.scalar() or 0,
        "done": done.scalar() or 0,
        "projects_count": projects.scalar() or 0,
    }


async def update_user_admin_fields(db: AsyncSession, user_id: UUID, new_system_role: str | None = None, new_role: str | None = None) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if new_system_role is not None:
        user.system_role = new_system_role
    if new_role is not None:
        user.role = new_role
    await db.flush()
    return user


async def delete_user(db: AsyncSession, user_id: UUID) -> bool:
    from app.db.models import Notification, Comment, Invitation, project_members, TaskAttachment, Project
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return False
        
    uid_str = str(user_id)
    await db.execute(delete(Notification).where(Notification.user_id == uid_str))
    await db.execute(delete(Comment).where(Comment.author_id == uid_str))
    await db.execute(delete(Invitation).where(Invitation.created_by == uid_str))
    await db.execute(project_members.delete().where(project_members.c.user_id == uid_str))

    await db.execute(update(Task).where(Task.assignee_id == uid_str).values(assignee_id=None))
    await db.execute(update(Task).where(Task.created_by == uid_str).values(created_by=None))
    await db.execute(update(Project).where(Project.owner_id == uid_str).values(owner_id=None))
    await db.execute(update(TaskAttachment).where(TaskAttachment.uploaded_by == uid_str).values(uploaded_by=None))

    await db.delete(user)
    await db.flush()
    return True
