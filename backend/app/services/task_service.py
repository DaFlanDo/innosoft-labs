"""Task service — business logic for tasks and comments."""

from uuid import UUID
from fastapi import HTTPException

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Task, Comment, User, Project, TaskAttachment, task_tags
from app.schemas.task import TaskCreate, TaskUpdate
from app.core.permissions import is_admin, can_approve_task
from app.services.storage_service import get_presigned_url, object_name_from_url


async def list_tasks(db: AsyncSession, project_id: UUID | None = None, user_id: UUID | None = None) -> list[dict]:
    """List tasks, optionally filtered by project or user.
    If user_id is provided, returns tasks from user's projects + tasks assigned to user.
    """
    stmt = select(Task).order_by(Task.created_at.desc())
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    elif user_id:
        # Tasks from user's projects + tasks assigned to user
        from app.db.models import project_members as pm
        user_project_ids = select(pm.c.project_id).where(pm.c.user_id == str(user_id))
        stmt = stmt.where(
            (Task.project_id.in_(user_project_ids)) | (Task.assignee_id == str(user_id))
        )
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    output = []
    for t in tasks:
        # Tags
        tags_result = await db.execute(
            select(task_tags.c.tag).where(task_tags.c.task_id == t.id)
        )
        tags = [row[0] for row in tags_result.all()]

        # Project name
        project_name = None
        if t.project_id:
            proj_result = await db.execute(select(Project.name).where(Project.id == t.project_id))
            project_name = proj_result.scalar_one_or_none()

        # Assignee info
        assignee_name = None
        assignee_initials = None
        if t.assignee_id:
            user_result = await db.execute(
                select(User.name, User.initials).where(User.id == t.assignee_id)
            )
            row = user_result.one_or_none()
            if row:
                assignee_name, assignee_initials = row

        output.append({
            "id": t.id,
            "title": t.title,
            "description": t.description or "",
            "brief": t.brief or "",
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "project_id": t.project_id,
            "assignee_id": t.assignee_id,
            "created_by": t.created_by,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "tags": tags,
            "project_name": project_name,
            "assignee_name": assignee_name,
            "assignee_initials": assignee_initials,
        })
    return output


async def get_task(db: AsyncSession, task_id: UUID) -> dict | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        return None

    tags_result = await db.execute(
        select(task_tags.c.tag).where(task_tags.c.task_id == t.id)
    )
    tags = [row[0] for row in tags_result.all()]

    project_name = None
    if t.project_id:
        proj_result = await db.execute(select(Project.name).where(Project.id == t.project_id))
        project_name = proj_result.scalar_one_or_none()

    assignee_name = None
    assignee_initials = None
    if t.assignee_id:
        user_result = await db.execute(
            select(User.name, User.initials).where(User.id == t.assignee_id)
        )
        row = user_result.one_or_none()
        if row:
            assignee_name, assignee_initials = row

    return {
        "id": t.id,
        "title": t.title,
        "description": t.description or "",
        "brief": t.brief or "",
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date,
        "project_id": t.project_id,
        "assignee_id": t.assignee_id,
        "created_by": t.created_by,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "tags": tags,
        "project_name": project_name,
        "assignee_name": assignee_name,
        "assignee_initials": assignee_initials,
    }


async def create_task(db: AsyncSession, data: TaskCreate, creator_id: UUID) -> Task:
    task = Task(
        title=data.title,
        description=data.description,
        brief=data.brief,
        status=data.status,
        priority=data.priority,
        due_date=data.due_date,
        project_id=data.project_id,
        assignee_id=data.assignee_id,
        created_by=creator_id,
    )
    db.add(task)
    await db.flush()

    # Add tags
    for tag in data.tags:
        await db.execute(task_tags.insert().values(task_id=task.id, tag=tag))

    await db.flush()
    return task


async def update_task(db: AsyncSession, task_id: UUID, data: TaskUpdate) -> Task | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        return None

    update_data = data.model_dump(exclude_unset=True)
    tags = update_data.pop("tags", None)

    for key, value in update_data.items():
        setattr(task, key, value)

    # Update tags if provided
    if tags is not None:
        await db.execute(delete(task_tags).where(task_tags.c.task_id == task_id))
        for tag in tags:
            await db.execute(task_tags.insert().values(task_id=task_id, tag=tag))

    await db.flush()
    return task


async def delete_task(db: AsyncSession, task_id: UUID) -> bool:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        return False
    await db.delete(task)
    await db.flush()
    return True


# ─── Workflow: review / approve / reject ───────────────────────

async def submit_task_for_review(db: AsyncSession, task_id: UUID, current_user: User) -> Task:
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Задача не найдена")

    if task.assignee_id != str(current_user.id) and not is_admin(current_user):
        raise HTTPException(403, "Только исполнитель может отправить задачу на проверку")

    if task.status not in ("todo", "in_progress", "rejected"):
        raise HTTPException(400, f"Нельзя отправить на проверку задачу со статусом: {task.status}")

    task.status = "pending_review"
    await db.flush()
    return task


async def approve_task_review(db: AsyncSession, task_id: UUID, current_user: User) -> Task:
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Задача не найдена")

    if task.status != "pending_review":
        raise HTTPException(400, "Задача не находится на проверке")

    if task.project_id and not await can_approve_task(db, task.project_id, current_user):
        raise HTTPException(403, "Только менеджер проекта может утверждать задачи")

    task.status = "done"
    await db.flush()
    return task


async def reject_task_review(db: AsyncSession, task_id: UUID, current_user: User, comment: str = "") -> Task:
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Задача не найдена")

    if task.status != "pending_review":
        raise HTTPException(400, "Задача не находится на проверке")

    if task.project_id and not await can_approve_task(db, task.project_id, current_user):
        raise HTTPException(403, "Только менеджер проекта может отклонять задачи")

    task.status = "in_progress"
    if comment:
        await create_comment(db, task_id, comment, current_user.id)
    await db.flush()
    return task


# ─── Comments ─────────────────────────────────

async def list_comments(db: AsyncSession, task_id: UUID) -> list[dict]:
    stmt = (
        select(Comment, User.name)
        .join(User, Comment.author_id == User.id, isouter=True)
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": c.id,
            "content": c.content,
            "task_id": c.task_id,
            "author_id": c.author_id,
            "author_name": name,
            "created_at": c.created_at,
        }
        for c, name in rows
    ]


async def create_comment(db: AsyncSession, task_id: UUID, content: str, author_id: UUID) -> Comment:
    comment = Comment(
        content=content,
        task_id=task_id,
        author_id=author_id,
    )
    db.add(comment)
    await db.flush()
    return comment


# ─── Attachments ──────────────────────────────

async def list_attachments(db: AsyncSession, task_id: UUID) -> list[dict]:
    stmt = (
        select(TaskAttachment, User.name)
        .join(User, TaskAttachment.uploaded_by == User.id, isouter=True)
        .where(TaskAttachment.task_id == str(task_id))
        .order_by(TaskAttachment.created_at)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": a.id,
            "task_id": a.task_id,
            "uploaded_by": a.uploaded_by,
            "uploader_name": name,
            "file_name": a.file_name,
            "file_url": _presigned(a.file_url),
            "file_size": a.file_size,
            "mime_type": a.mime_type,
            "created_at": a.created_at,
        }
        for a, name in rows
    ]


def _presigned(stored_url: str) -> str:
    obj = object_name_from_url(stored_url)
    if obj:
        try:
            return get_presigned_url(obj)
        except Exception:
            pass
    return stored_url


async def create_attachment(db: AsyncSession, task_id: UUID, uploader_id: UUID, file_name: str, file_url: str, file_size: int | None, mime_type: str | None) -> TaskAttachment:
    att = TaskAttachment(
        task_id=str(task_id),
        uploaded_by=str(uploader_id),
        file_name=file_name,
        file_url=file_url,
        file_size=file_size,
        mime_type=mime_type,
    )
    db.add(att)
    await db.flush()
    return att


async def delete_attachment(db: AsyncSession, attachment_id: UUID, task_id: UUID) -> bool:
    result = await db.execute(
        select(TaskAttachment).where(
            TaskAttachment.id == str(attachment_id),
            TaskAttachment.task_id == str(task_id),
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        return False
    await db.delete(att)
    await db.flush()
    return True
