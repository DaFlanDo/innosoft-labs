from uuid import UUID
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.db.models import Activity, Project, Task, User, project_members

async def log_activity(
    db: AsyncSession, 
    user_id: UUID, 
    type: str, 
    content: str, 
    project_id: UUID | None = None, 
    task_id: UUID | None = None
):
    activity = Activity(
        user_id=str(user_id),
        type=type,
        content=content,
        project_id=str(project_id) if project_id else None,
        task_id=str(task_id) if task_id else None
    )
    db.add(activity)
    # We yield to the caller for commit

async def list_activities(db: AsyncSession, user: User, limit: int = 50):
    # RBAC: If admin, see all. If member, see only for projects they are in.
    query = select(Activity).options(
        selectinload(Activity.user),
        selectinload(Activity.project),
        selectinload(Activity.task)
    ).order_by(desc(Activity.created_at)).limit(limit)

    if user.system_role != "admin":
        # Subquery for project IDs the user belongs to
        user_projects_stmt = select(project_members.c.project_id).where(project_members.c.user_id == user.id)
        # Also include activities with no project_id (global maybe?) but usually we want project context
        query = query.where(Activity.project_id.in_(user_projects_stmt))

    result = await db.execute(query)
    activities = result.scalars().all()
    
    out = []
    for a in activities:
        out.append({
            "id": a.id,
            "project_id": a.project_id,
            "task_id": a.task_id,
            "user_id": a.user_id,
            "type": a.type,
            "content": a.content,
            "created_at": a.created_at,
            "user_name": a.user.name if a.user else "System",
            "project_name": a.project.name if a.project else None,
            "task_title": a.task.title if a.task else None
        })
    return out
