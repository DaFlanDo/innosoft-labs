from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, get_current_user
from app.db.models import User
from app.schemas.activity import ActivityOut
from app.services import activity_service
from app.core.permissions import require_project_role, is_admin, require_manager_or_admin

router = APIRouter(prefix="/api/activities", tags=["Activity"])

@router.get("", response_model=list[ActivityOut])
async def get_activity_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 50
):
    """
    Get activity feed with RBAC: 
    - Admin/Manager: sees activities for projects they belong to
    - Member: Access Denied
    """
    await require_manager_or_admin(current_user)
    return await activity_service.list_activities(db, current_user, limit=limit)
