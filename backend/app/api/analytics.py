"""Analytics API — /api/analytics/* (cached in Redis for 5 min)"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.permissions import require_manager_or_admin
from app.db.models import User
from app.services import analytics_service


async def _manager_or_admin(current_user: Annotated[User, Depends(get_current_user)]) -> None:
    # Сводка по всем проектам — участникам она не показывается и в интерфейсе
    await require_manager_or_admin(current_user)


router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
    dependencies=[Depends(_manager_or_admin)],
)


@router.get("/summary")
async def summary(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_summary(db)


@router.get("/tasks-by-project")
async def tasks_by_project(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_tasks_by_project(db)


@router.get("/team-performance")
async def team_performance(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_team_performance(db)
