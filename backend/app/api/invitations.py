"""Invitations API

Project invite:  POST /api/projects/:id/invitations  (manager+)
Manager invite:  POST /api/admin/invite-manager       (admin only)
Public:          GET/POST /api/invite/:token
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.security import hash_password, create_access_token
from app.core.permissions import require_project_role, require_admin, is_admin
from app.db.models import User, Project, Invitation
from app.schemas.invitation import (
    InvitationCreate, ManagerInviteCreate, InvitationOut, InviteInfo, InviteRegister,
)
from app.schemas.user import UserOut
from app.services import invitation_service
from app.db.models import invitation_projects

router = APIRouter(tags=["Invitations"])

DB = Annotated[AsyncSession, Depends(get_db)]
Me = Annotated[User, Depends(get_current_user)]


def _build_url(request: Request, token: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/invite/{token}"


def _inv_out(inv: Invitation, url: str, project_ids: list[UUID] | None = None) -> InvitationOut:
    return InvitationOut(
        id=inv.id,
        token=inv.token,
        invite_type=inv.invite_type,
        project_id=inv.project_id,
        project_ids=project_ids or ([inv.project_id] if inv.project_id else []),
        role=inv.role,
        profession=inv.profession,
        created_by=inv.created_by,
        email=inv.email,
        max_uses=inv.max_uses,
        uses_count=inv.uses_count,
        expires_at=inv.expires_at,
        is_active=inv.is_active,
        created_at=inv.created_at,
        invite_url=url,
    )


# ── Проектные инвайты ──────────────────────────────────────────────

@router.post("/api/projects/{project_id}/invitations", response_model=InvitationOut, status_code=201)
async def create_project_invitation(
    project_id: UUID, body: InvitationCreate,
    request: Request, db: DB, current_user: Me,
):
    await require_project_role(db, project_id, current_user, min_role="manager")
    if not is_admin(current_user) and body.role not in ("member", "viewer"):
        raise HTTPException(403, "Менеджер может добавлять только участников и наблюдателей")
    if body.role not in ("member", "viewer", "manager"):
        raise HTTPException(400, "Роль для участника: member, viewer или manager")
    inv = await invitation_service.create_project_invitation(db, project_id, body, current_user.id)
    await db.commit()
    return _inv_out(inv, _build_url(request, inv.token))


@router.get("/api/projects/{project_id}/invitations", response_model=list[InvitationOut])
async def list_project_invitations(
    project_id: UUID, request: Request, db: DB, current_user: Me,
):
    await require_project_role(db, project_id, current_user, min_role="manager")
    invitations = await invitation_service.list_invitations(db, project_id)
    return [_inv_out(inv, _build_url(request, inv.token)) for inv in invitations]


@router.delete("/api/projects/{project_id}/invitations/{invitation_id}", status_code=204)
async def deactivate_invitation(
    project_id: UUID, invitation_id: UUID, db: DB, current_user: Me,
):
    await require_project_role(db, project_id, current_user, min_role="manager")
    success = await invitation_service.deactivate_invitation(db, invitation_id)
    if not success:
        raise HTTPException(404, "Приглашение не найдено")
    await db.commit()


# ── Manager инвайт (только admin) ─────────────────────────────────

@router.post("/api/admin/invite-manager", response_model=InvitationOut, status_code=201)
async def create_manager_invitation(
    body: ManagerInviteCreate, request: Request, db: DB, current_user: Me,
):
    await require_admin(current_user)
    inv = await invitation_service.create_manager_invitation(db, body, current_user.id)
    await db.commit()
    return _inv_out(inv, _build_url(request, inv.token), body.project_ids)


# ── Публичные эндпоинты инвайт-ссылки ─────────────────────────────

@router.get("/api/invite/{token}", response_model=InviteInfo)
async def get_invite_info(token: str, db: DB):
    """Публичная информация об инвайте — без авторизации."""
    inv = await invitation_service.get_invitation_by_token(db, token)
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")

    result = await db.execute(select(User.name).where(User.id == inv.created_by))
    creator_name = result.scalar_one_or_none() or "Неизвестный"
    is_valid, message = await invitation_service.validate_invitation(inv)

    project_name = None
    project_names: list[str] = []
    project_color = None
    if inv.invite_type == "project" and inv.project_id:
        r = await db.execute(select(Project).where(Project.id == inv.project_id))
        project = r.scalar_one_or_none()
        project_name = project.name if project else "Удалённый проект"
        project_color = project.color if project else "#6C5CE7"
    elif inv.invite_type == "manager":
        rows = await db.execute(
            select(Project.name)
            .join(invitation_projects, invitation_projects.c.project_id == Project.id)
            .where(invitation_projects.c.invitation_id == inv.id)
        )
        project_names = [row[0] for row in rows.all()]

    return InviteInfo(
        invite_type=inv.invite_type,
        project_name=project_name,
        project_names=project_names,
        project_color=project_color,
        invited_email=inv.email,
        role=inv.role,
        profession=inv.profession,
        created_by_name=creator_name,
        is_valid=is_valid,
        message=message,
    )


@router.post("/api/invite/{token}/accept")
async def accept_invite(token: str, db: DB, current_user: Me):
    """Принять приглашение — для уже авторизованного пользователя."""
    inv = await invitation_service.get_invitation_by_token(db, token)
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")

    if inv.invite_type == "manager":
        success, message = await invitation_service.accept_manager_invitation(db, inv, current_user)
    else:
        success, message = await invitation_service.accept_project_invitation(db, inv, current_user)

    if not success:
        raise HTTPException(400, message)
    await db.commit()
    return {"detail": message}


@router.post("/api/invite/{token}/register")
async def register_and_accept(token: str, body: InviteRegister, db: DB):
    """Зарегистрироваться и принять приглашение за один шаг."""
    inv = await invitation_service.get_invitation_by_token(db, token)
    if not inv:
        raise HTTPException(404, "Приглашение не найдено")

    is_valid, error = await invitation_service.validate_invitation(inv)
    if not is_valid:
        raise HTTPException(400, error)

    effective_email = (body.email or inv.email or "").strip().lower()
    if not effective_email:
        raise HTTPException(400, "Email обязателен для регистрации")

    if inv.email and inv.email.lower() != effective_email:
        raise HTTPException(400, "Это приглашение предназначено для другого email")

    existing = await db.execute(select(User).where(User.email == effective_email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email уже зарегистрирован. Войдите и примите приглашение.")

    system_role = inv.role if inv.invite_type == "manager" else "member"
    user = User(
        name=body.name,
        email=effective_email,
        password_hash=hash_password(body.password),
        initials=body.initials or body.name[:2].upper(),
        role="",
        system_role=system_role,
    )
    db.add(user)
    await db.flush()

    if inv.invite_type == "manager":
        success, message = await invitation_service.accept_manager_invitation(db, inv, user)
    else:
        success, message = await invitation_service.accept_project_invitation(db, inv, user)

    if not success:
        raise HTTPException(400, message)

    await db.commit()
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
        "detail": message,
    }
