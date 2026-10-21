"""Analytics service — cached aggregations via Redis."""

from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Task, Project, User, project_members, task_tags
from app.cache.redis import cache_get, cache_set

CACHE_TTL = 300  # 5 minutes


async def get_summary(db: AsyncSession) -> dict:
    key = "analytics:summary"
    cached = await cache_get(key)
    if cached:
        return cached

    total_projects = (await db.execute(select(func.count()).select_from(Project))).scalar() or 0
    total_tasks = (await db.execute(select(func.count()).select_from(Task))).scalar() or 0
    done_tasks = (await db.execute(
        select(func.count()).select_from(Task).where(Task.status == "done")
    )).scalar() or 0
    in_progress = (await db.execute(
        select(func.count()).select_from(Task).where(Task.status == "progress")
    )).scalar() or 0
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0

    data = {
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "completed_tasks": done_tasks,
        "in_progress_tasks": in_progress,
        "team_members": total_users,
    }
    await cache_set(key, data, CACHE_TTL)
    return data


async def get_tasks_by_project(db: AsyncSession) -> list[dict]:
    key = "analytics:tasks_by_project"
    cached = await cache_get(key)
    if cached:
        return cached

    stmt = (
        select(Project.name, Project.color, func.count(Task.id).label("count"))
        .join(Task, Task.project_id == Project.id, isouter=True)
        .group_by(Project.id, Project.name, Project.color)
        .order_by(Project.name)
    )
    result = await db.execute(stmt)
    data = [{"name": r.name, "color": r.color, "count": r.count} for r in result.all()]
    await cache_set(key, data, CACHE_TTL)
    return data


async def get_team_performance(db: AsyncSession) -> list[dict]:
    key = "analytics:team_performance"
    cached = await cache_get(key)
    if cached:
        return cached

    stmt = (
        select(
            User.name,
            User.initials,
            User.role,
            func.count(Task.id).label("total"),
            func.sum(case((Task.status == "done", 1), else_=0)).label("completed"),
        )
        .join(Task, Task.assignee_id == User.id, isouter=True)
        .group_by(User.id, User.name, User.initials, User.role)
        .order_by(func.sum(case((Task.status == "done", 1), else_=0)).desc())
    )
    result = await db.execute(stmt)
    data = [
        {
            "name": r.name,
            "initials": r.initials,
            "role": r.role,
            "total_tasks": r.total,
            "completed": r.completed,
        }
        for r in result.all()
    ]
    await cache_set(key, data, CACHE_TTL)
    return data
