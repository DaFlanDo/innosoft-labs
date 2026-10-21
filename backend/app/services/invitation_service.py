"""Invitation service — business logic for invite links.

Два типа инвайтов:
  project — менеджер приглашает участника в конкретный проект
  manager — admin приглашает нового менеджера (без привязки к проекту)
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Invitation, User, project_members, invitation_projects
from app.schemas.invitation import InvitationCreate, ManagerInviteCreate


async def create_project_invitation(db, project_id, data: InvitationCreate, creator_id) -> Invitation:
    """Менеджер создаёт инвайт в конкретный проект."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
    invitation = Invitation(
        invite_type="project",
        project_id=str(project_id),
        role=data.role,
        created_by=str(creator_id),
        email=data.email,
        profession=data.profession,
        max_uses=data.max_uses,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.flush()
    return invitation


async def create_manager_invitation(db, data: ManagerInviteCreate, creator_id) -> Invitation:
    """Admin создаёт инвайт для нового менеджера (может включать проекты)."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
    invitation = Invitation(
        invite_type="manager",
        project_id=None,
        role=data.system_role,
        created_by=str(creator_id),
        email=data.email,
        profession=data.profession,
        max_uses=data.max_uses,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.flush()

    for project_id in data.project_ids:
        await db.execute(
            invitation_projects.insert().values(
                invitation_id=str(invitation.id),
                project_id=str(project_id),
            )
        )

    return invitation


async def list_invitations(db, project_id) -> list[Invitation]:
    result = await db.execute(
        select(Invitation)
        .where(Invitation.project_id == str(project_id))
        .order_by(Invitation.created_at.desc())
    )
    return list(result.scalars().all())


async def deactivate_invitation(db, invitation_id) -> bool:
    result = await db.execute(select(Invitation).where(Invitation.id == str(invitation_id)))
    inv = result.scalar_one_or_none()
    if not inv:
        return False
    inv.is_active = False
    await db.flush()
    return True


async def get_invitation_by_token(db, token: str) -> Invitation | None:
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    return result.scalar_one_or_none()


async def validate_invitation(invitation: Invitation) -> tuple[bool, str | None]:
    if not invitation.is_active:
        return False, "Приглашение деактивировано"
    expires = invitation.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return False, "Срок действия приглашения истёк"
    if invitation.max_uses > 0 and invitation.uses_count >= invitation.max_uses:
        return False, "Приглашение уже использовано максимальное число раз"
    return True, None


async def accept_project_invitation(db, invitation: Invitation, user: User) -> tuple[bool, str]:
    """Принять инвайт в проект — добавить пользователя в project_members."""
    is_valid, error = await validate_invitation(invitation)
    if not is_valid:
        return False, error
    if invitation.email and invitation.email.lower() != user.email.lower():
        return False, "Это приглашение предназначено для другого email"
    
    if invitation.profession:
        user.role = invitation.profession

    existing = await db.execute(
        select(project_members).where(
            project_members.c.project_id == invitation.project_id,
            project_members.c.user_id == str(user.id),
        )
    )
    if existing.one_or_none():
        return False, "Вы уже являетесь участником этого проекта"
    await db.execute(
        project_members.insert().values(
            project_id=invitation.project_id,
            user_id=str(user.id),
            role=invitation.role,
        )
    )
    invitation.uses_count += 1
    await db.flush()
    return True, "Вы успешно добавлены в проект!"


async def accept_manager_invitation(db, invitation: Invitation, user: User) -> tuple[bool, str]:
    """Принять manager-инвайт — установить system_role = 'manager'."""
    is_valid, error = await validate_invitation(invitation)
    if not is_valid:
        return False, error
    if invitation.email and invitation.email.lower() != user.email.lower():
        return False, "Это приглашение предназначено для другого email"

    project_rows = await db.execute(
        select(invitation_projects.c.project_id).where(invitation_projects.c.invitation_id == str(invitation.id))
    )
    project_ids = [row[0] for row in project_rows.all()]

    user.system_role = invitation.role
    if invitation.profession:
        user.role = invitation.profession

    for project_id in project_ids:
        existing = await db.execute(
            select(project_members).where(
                project_members.c.project_id == str(project_id),
                project_members.c.user_id == str(user.id),
            )
        )
        if existing.one_or_none():
            continue
        await db.execute(
            project_members.insert().values(
                project_id=str(project_id),
                user_id=str(user.id),
                role="manager",
            )
        )

    invitation.uses_count += 1
    await db.flush()
    role_label = "администратор" if invitation.role == "admin" else "менеджер"
    if project_ids:
        return True, f"Вы зарегистрированы как {role_label} и добавлены в {len(project_ids)} проект(ов)!"
    return True, f"Вы зарегистрированы как {role_label}!"
