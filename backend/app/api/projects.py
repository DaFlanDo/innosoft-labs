"""Projects API — /api/projects/*"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.permissions import (
    require_project_role,
    can_create_project,
    can_delete_project,
    can_manage_members,
    is_admin,
)
from app.db.models import User
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, MemberAdd, MemberOut
from app.services import project_service
from app.cache.redis import cache_invalidate_pattern
from app.socket.handlers import emit_project_updated

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut])
async def get_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Admins see all; regular users see only their projects
    if is_admin(current_user):
        return await project_service.list_projects(db)
    return await project_service.list_projects(db, user_id=current_user.id)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not await can_create_project(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только администратор может создавать проекты")
    project = await project_service.create_project(db, body, current_user.id)
    await cache_invalidate_pattern("analytics:*")
    data = await project_service.get_project(db, project.id)
    return data


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Any project member (or admin) can view
    await require_project_role(db, project_id, current_user, min_role="viewer")
    data = await project_service.get_project(db, project_id)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return data


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Only manager+ can edit project
    await require_project_role(db, project_id, current_user, min_role="manager")
    project = await project_service.update_project(db, project_id, body)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    data = await project_service.get_project(db, project.id)
    if data:
        await emit_project_updated(str(project_id), data)
    return data


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not await can_delete_project(db, project_id, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для удаления проекта")
    deleted = await project_service.delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await cache_invalidate_pattern("analytics:*")


@router.get("/{project_id}/members", response_model=list[MemberOut])
async def get_members(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await require_project_role(db, project_id, current_user, min_role="viewer")
    return await project_service.get_project_members(db, project_id)


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    project_id: UUID,
    body: MemberAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not await can_manage_members(db, project_id, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для управления участниками")
    if not is_admin(current_user) and body.role not in ("member", "viewer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Менеджер может добавлять только участников и наблюдателей")
    await project_service.add_project_member(db, project_id, body.user_id, body.role)
    return {"detail": "Member added"}
