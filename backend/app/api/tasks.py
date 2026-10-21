"""Tasks API — /api/tasks/* and /api/projects/:id/tasks"""

import uuid as _uuid
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.permissions import (
    require_project_role,
    can_create_task,
    can_update_task,
    can_approve_task,
    is_admin,
)
from app.db.models import User, Task, TaskAttachment, Notification
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, CommentCreate, CommentOut, AttachmentOut, RejectBody
from app.services import task_service, activity_service
from app.services.storage_service import upload_file, get_presigned_url, object_name_from_url
from app.cache.redis import cache_invalidate_pattern
from app.socket.handlers import (
    emit_task_created,
    emit_task_updated,
    emit_task_deleted,
    emit_notification,
)

router = APIRouter(tags=["Tasks"])

DB = Annotated[AsyncSession, Depends(get_db)]
Me = Annotated[User, Depends(get_current_user)]


async def _get_task_checked(db: AsyncSession, task_id: UUID, user: User, min_role: str) -> Task:
    """Задача, к которой у пользователя есть доступ не ниже min_role, иначе 404/403.

    Задачи без проекта (личные) видят только автор, исполнитель и админ.
    """
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(404, "Задача не найдена")
    if is_admin(user):
        return task
    if task.project_id:
        await require_project_role(db, task.project_id, user, min_role=min_role)
    elif str(user.id) not in (str(task.created_by), str(task.assignee_id)):
        raise HTTPException(403, "Нет доступа к задаче")
    return task


@router.get("/api/tasks", response_model=list[TaskOut])
async def get_all_tasks(db: DB, current_user: Me):
    if is_admin(current_user):
        return await task_service.list_tasks(db)
    return await task_service.list_tasks(db, user_id=current_user.id)


@router.get("/api/projects/{project_id}/tasks", response_model=list[TaskOut])
async def get_project_tasks(project_id: UUID, db: DB, current_user: Me):
    await require_project_role(db, project_id, current_user, min_role="viewer")
    return await task_service.list_tasks(db, project_id=project_id)


@router.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, db: DB, current_user: Me):
    if body.project_id:
        if not await can_create_task(db, body.project_id, current_user):
            raise HTTPException(403, "Только менеджер проекта может создавать задачи")
    task = await task_service.create_task(db, body, current_user.id)
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await task_service.get_task(db, task.id)
    if data and data.get("project_id"):
        await emit_task_created(str(data["project_id"]), data)
        await activity_service.log_activity(db, current_user.id, "task_created", f"Создал задачу «{task.title}»", project_id=task.project_id, task_id=task.id)
        await db.commit()
    return data


@router.get("/api/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: UUID, db: DB, current_user: Me):
    data = await task_service.get_task(db, task_id)
    if not data:
        raise HTTPException(404, "Задача не найдена")
    if data.get("project_id") and not is_admin(current_user):
        await require_project_role(db, data["project_id"], current_user, min_role="viewer")
    return data


@router.patch("/api/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: UUID, body: TaskUpdate, db: DB, current_user: Me):
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Задача не найдена")

    if existing.project_id and not is_admin(current_user):
        if not await can_update_task(db, existing.project_id, current_user, existing.assignee_id):
            raise HTTPException(403, "Недостаточно прав для редактирования этой задачи")
        
        # Prevent members from closing tasks directly
        if body.status == "done":
            if not await can_approve_task(db, existing.project_id, current_user):
                 raise HTTPException(403, "Вы не можете самостоятельно закрыть задачу. Отправьте её на проверку.")

    task = await task_service.update_task(db, task_id, body)
    
    # Activity log
    if body.status:
        await activity_service.log_activity(db, current_user.id, "status_changed", f"Сменил статус задачи «{existing.title}» на {body.status}", project_id=existing.project_id, task_id=existing.id)
    else:
        await activity_service.log_activity(db, current_user.id, "task_updated", f"Обновил задачу «{existing.title}»", project_id=existing.project_id, task_id=existing.id)

    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await task_service.get_task(db, task.id)
    if data and data.get("project_id"):
        await emit_task_updated(str(data["project_id"]), data)
    return data


@router.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: UUID, db: DB, current_user: Me):
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Задача не найдена")
    if existing.project_id and not is_admin(current_user):
        await require_project_role(db, existing.project_id, current_user, min_role="manager")
    project_id = existing.project_id
    title = existing.title
    deleted = await task_service.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(404, "Задача не найдена")
    
    await activity_service.log_activity(db, current_user.id, "task_deleted", f"Удалил задачу «{title}»", project_id=project_id)
    
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    if project_id:
        await emit_task_deleted(str(project_id), str(task_id))


# ── Утверждение задач ──────────────────────────────────────────────

@router.post("/api/tasks/{task_id}/submit-review", response_model=TaskOut)
async def submit_for_review(task_id: UUID, db: DB, current_user: Me):
    """Участник отправляет задачу на проверку менеджеру."""
    task = await task_service.submit_task_for_review(db, task_id, current_user)
    await activity_service.log_activity(db, current_user.id, "status_changed", f"Отправил задачу «{task.title}» на проверку", project_id=task.project_id, task_id=task.id)
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await task_service.get_task(db, task_id)
    if data and data.get("project_id"):
        await emit_task_updated(str(data["project_id"]), data)
    return data


@router.post("/api/tasks/{task_id}/approve", response_model=TaskOut)
async def approve_task(task_id: UUID, db: DB, current_user: Me):
    """Менеджер принимает выполнение задачи → статус done."""
    task = await task_service.approve_task_review(db, task_id, current_user)
    await activity_service.log_activity(db, current_user.id, "status_changed", f"Принял задачу «{task.title}»", project_id=task.project_id, task_id=task.id)
    if task.assignee_id:
        nt = Notification(
            user_id=task.assignee_id,
            type="task_approved",
            message=f"Задача «{task.title}» принята",
        )
        db.add(nt)
        await db.flush()
        await emit_notification(str(task.assignee_id), {
            "id": str(nt.id),
            "type": nt.type,
            "message": nt.message,
            "is_read": False,
            "created_at": nt.created_at.isoformat() if hasattr(nt.created_at, "isoformat") else str(nt.created_at)
        })
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await task_service.get_task(db, task.id)
    if data and data.get("project_id"):
        await emit_task_updated(str(data["project_id"]), data)
    return data


@router.post("/api/tasks/{task_id}/reject", response_model=TaskOut)
async def reject_task(task_id: UUID, body: RejectBody, db: DB, current_user: Me):
    """Менеджер возвращает задачу исполнителю → статус in_progress."""
    task = await task_service.reject_task_review(db, task_id, current_user, body.comment)
    await activity_service.log_activity(db, current_user.id, "status_changed", f"Вернул задачу «{task.title}» на доработку", project_id=task.project_id, task_id=task.id)
    if task.assignee_id:
        comment_text = body.comment or "Задача возвращена на доработку"
        nt = Notification(
            user_id=task.assignee_id,
            type="task_rejected",
            message=f"Задача «{task.title}» возвращена: {comment_text}",
        )
        db.add(nt)
        await db.flush()
        await emit_notification(str(task.assignee_id), {
            "id": str(nt.id),
            "type": nt.type,
            "message": nt.message,
            "is_read": False,
            "created_at": nt.created_at.isoformat() if hasattr(nt.created_at, "isoformat") else str(nt.created_at)
        })
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await task_service.get_task(db, task.id)
    if data and data.get("project_id"):
        await emit_task_updated(str(data["project_id"]), data)
    return data


# ── Комментарии ────────────────────────────────────────────────────

@router.get("/api/tasks/{task_id}/comments", response_model=list[CommentOut])
async def get_comments(task_id: UUID, db: DB, current_user: Me):
    await _get_task_checked(db, task_id, current_user, min_role="viewer")
    return await task_service.list_comments(db, task_id)


@router.post("/api/tasks/{task_id}/comments", response_model=CommentOut, status_code=201)
async def create_comment(task_id: UUID, body: CommentCreate, db: DB, current_user: Me):
    existing = await _get_task_checked(db, task_id, current_user, min_role="member")

    comment = await task_service.create_comment(db, task_id, body.content, current_user.id)

    if existing:
        await activity_service.log_activity(db, current_user.id, "comment_added", f"Оставил комментарий к задаче «{existing.title}»", project_id=existing.project_id, task_id=existing.id)
    
    await db.commit()
    return {
        "id": comment.id,
        "content": comment.content,
        "task_id": comment.task_id,
        "author_id": comment.author_id,
        "author_name": current_user.name,
        "created_at": comment.created_at,
    }


# ── Вложения ───────────────────────────────────────────────────────

@router.get("/api/tasks/{task_id}/attachments", response_model=list[AttachmentOut])
async def get_attachments(task_id: UUID, db: DB, current_user: Me):
    await _get_task_checked(db, task_id, current_user, min_role="viewer")
    return await task_service.list_attachments(db, task_id)


@router.post("/api/tasks/{task_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(task_id: UUID, file: Annotated[UploadFile, File()], db: DB, current_user: Me):
    await _get_task_checked(db, task_id, current_user, min_role="member")
    data = await file.read()
    object_name = f"attachments/{task_id}/{_uuid.uuid4()}_{file.filename}"
    file_url = upload_file(object_name, data, file.content_type or "application/octet-stream")
    att = await task_service.create_attachment(
        db,
        task_id=task_id,
        uploader_id=current_user.id,
        file_name=file.filename,
        file_url=file_url,
        file_size=len(data),
        mime_type=file.content_type,
    )
    
    result = await db.execute(select(Task).where(Task.id == str(task_id)))
    task = result.scalar_one_or_none()
    if task:
        await activity_service.log_activity(db, current_user.id, "attachment_added", f"Прикрепил файл «{file.filename}» к задаче «{task.title}»", project_id=task.project_id, task_id=task.id)

    await db.commit()
    return {
        "id": att.id,
        "task_id": att.task_id,
        "uploaded_by": att.uploaded_by,
        "uploader_name": current_user.name,
        "file_name": att.file_name,
        "file_url": get_presigned_url(object_name) if object_name else att.file_url,
        "file_size": att.file_size,
        "mime_type": att.mime_type,
        "created_at": att.created_at,
    }


@router.delete("/api/tasks/{task_id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(task_id: UUID, attachment_id: UUID, db: DB, current_user: Me):
    task = await _get_task_checked(db, task_id, current_user, min_role="member")
    # Чужое вложение удаляет только менеджер проекта (или админ)
    att = (await db.execute(
        select(TaskAttachment).where(TaskAttachment.id == str(attachment_id))
    )).scalar_one_or_none()
    if att and str(att.uploaded_by) != str(current_user.id) and task.project_id and not is_admin(current_user):
        await require_project_role(db, task.project_id, current_user, min_role="manager")
    deleted = await task_service.delete_attachment(db, attachment_id, task_id)
    if not deleted:
        raise HTTPException(404, "Вложение не найдено")
    await db.commit()
