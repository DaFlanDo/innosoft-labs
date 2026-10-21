"""Project service — business logic for projects."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Project, Task, User, project_members
from app.schemas.project import ProjectCreate, ProjectUpdate


async def list_projects(db: AsyncSession, user_id: UUID | None = None) -> list[dict]:
    """Get all projects with tasks_count and members_count.
    If user_id is provided, returns only projects where the user is a member.
    """
    if user_id:
        # Projects where user is a member or owner
        stmt = (
            select(Project)
            .outerjoin(project_members, Project.id == project_members.c.project_id)
            .where(
                (project_members.c.user_id == str(user_id)) |
                (Project.owner_id == str(user_id))
            )
            .order_by(Project.created_at.desc())
            .distinct()
        )
    else:
        stmt = select(Project).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    projects = result.scalars().all()

    output = []
    for p in projects:
        # Count tasks
        tasks_result = await db.execute(
            select(func.count()).select_from(Task).where(Task.project_id == p.id)
        )
        tasks_count = tasks_result.scalar() or 0

        # Count members
        members_result = await db.execute(
            select(func.count()).select_from(project_members).where(project_members.c.project_id == p.id)
        )
        members_count = members_result.scalar() or 0

        output.append({
            "id": p.id,
            "name": p.name,
            "description": p.description or "",
            "status": p.status,
            "priority": p.priority,
            "color": p.color,
            "deadline": p.deadline,
            "progress": p.progress,
            "owner_id": p.owner_id,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "tasks_count": tasks_count,
            "members_count": members_count,
        })
    return output


async def get_project(db: AsyncSession, project_id: UUID) -> dict | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    p = result.scalar_one_or_none()
    if not p:
        return None

    tasks_result = await db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == p.id)
    )
    tasks_count = tasks_result.scalar() or 0

    members_result = await db.execute(
        select(func.count()).select_from(project_members).where(project_members.c.project_id == p.id)
    )
    members_count = members_result.scalar() or 0

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description or "",
        "status": p.status,
        "priority": p.priority,
        "color": p.color,
        "deadline": p.deadline,
        "progress": p.progress,
        "owner_id": p.owner_id,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "tasks_count": tasks_count,
        "members_count": members_count,
    }


async def create_project(db: AsyncSession, data: ProjectCreate, owner_id: UUID) -> Project:
    project = Project(
        name=data.name,
        description=data.description,
        status=data.status,
        priority=data.priority,
        color=data.color,
        deadline=data.deadline,
        owner_id=owner_id,
    )
    db.add(project)
    await db.flush()

    # Add owner as project member
    await db.execute(
        project_members.insert().values(
            project_id=project.id, user_id=owner_id, role="manager"
        )
    )
    await db.flush()
    return project


async def update_project(db: AsyncSession, project_id: UUID, data: ProjectUpdate) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return None

    update_data = data.model_dump(exclude_unset=True)
    
    # Custom completion logic: if project is being set to "completed", optionally complete its tasks
    status_changed_to_completed = update_data.get("status") == "completed" and project.status != "completed"

    for key, value in update_data.items():
        setattr(project, key, value)

    if status_changed_to_completed:
        from sqlalchemy import update
        await db.execute(
            update(Task)
            .where(Task.project_id == project_id)
            .where(Task.status.notin_(["done", "pending_review"]))
            .values(status="done")
        )

    await db.flush()
    return project


async def delete_project(db: AsyncSession, project_id: UUID) -> bool:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return False
    await db.delete(project)
    await db.flush()
    return True


async def get_project_members(db: AsyncSession, project_id: UUID) -> list[dict]:
    stmt = (
        select(
            User.id, User.name, User.initials, User.system_role,
            User.role.label("profession"),
            project_members.c.role.label("project_role")
        )
        .join(project_members, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "user_id": r.id,
            "name": r.name,
            "initials": r.initials,
            "system_role": r.system_role,
            "profession": r.profession,
            "role": r.project_role,
        }
        for r in rows
    ]


async def add_project_member(db: AsyncSession, project_id: UUID, user_id: UUID, role: str = "member"):
    await db.execute(
        project_members.insert().values(
            project_id=project_id, user_id=user_id, role=role
        )
    )
    await db.flush()
