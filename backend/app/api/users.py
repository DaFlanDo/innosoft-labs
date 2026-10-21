"""Users API — /api/users/*"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.db.models import User
from app.schemas.user import UserOut, UserUpdate, UserStats, UserSystemRoleUpdate
from app.services import user_service
from app.services.storage_service import upload_file
from app.core.permissions import require_admin
from app.cache.redis import cache_invalidate_pattern

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
async def get_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    users = await user_service.list_users(db)
    return users


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    user = await user_service.update_user(db, current_user.id, body)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")

    contents = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "png"
    object_name = f"avatars/{current_user.id}.{ext}"

    url = upload_file(object_name, contents, file.content_type or "image/png")

    current_user.avatar_url = url
    await db.flush()
    return current_user


@router.get("/{user_id}/stats", response_model=UserStats)
async def get_stats(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return await user_service.get_user_stats(db, user_id)


@router.patch("/{user_id}/system-role", response_model=UserOut)
async def update_system_role(
    user_id: UUID,
    body: UserSystemRoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await require_admin(current_user)
    if body.system_role and body.system_role not in ("admin", "manager", "member"):
        raise HTTPException(status_code=400, detail="Invalid system_role")
        
    updated = await user_service.update_user_admin_fields(db, user_id, body.system_role, body.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await require_admin(current_user)
    if str(user_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    success = await user_service.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    await db.commit()
    await cache_invalidate_pattern("analytics:*")
