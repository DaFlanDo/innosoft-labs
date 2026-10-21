"""Analytics API — /api/analytics/* (cached in Redis for 5 min)"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/summary")
async def summary(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_summary(db)


@router.get("/tasks-by-project")
async def tasks_by_project(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_tasks_by_project(db)


@router.get("/team-performance")
async def team_performance(db: Annotated[AsyncSession, Depends(get_db)]):
    return await analytics_service.get_team_performance(db)
