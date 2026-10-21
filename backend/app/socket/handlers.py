"""WebSocket (python-socketio) event handlers.

Подключение только с JWT: клиент передаёт `auth={"token": ...}`. Комнаты
назначает сервер — личная `user:<id>` и `project:<id>` для каждого проекта,
где пользователь участник (админ — во всех). Чужой проект клиенту недоступен.
"""

import socketio
from sqlalchemy import select

from app.core.permissions import get_project_role
from app.core.security import decode_access_token
from app.db.database import async_session_factory
from app.db.models import Project, User, project_members

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    cors_credentials=True,
    logger=False,
    engineio_logger=False,
)


async def _user_from_token(token: str | None) -> User | None:
    if not token:
        return None
    try:
        user_id = decode_access_token(token).get("sub")
    except Exception:
        return None
    async with async_session_factory() as db:
        return (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()


async def _project_ids(user: User) -> list[str]:
    async with async_session_factory() as db:
        if user.system_role == "admin":
            rows = await db.execute(select(Project.id))
        else:
            rows = await db.execute(
                select(project_members.c.project_id).where(project_members.c.user_id == str(user.id))
            )
        return [str(r[0]) for r in rows.all()]


@sio.event
async def connect(sid, environ, auth=None):
    user = await _user_from_token((auth or {}).get("token"))
    if user is None:
        raise socketio.exceptions.ConnectionRefusedError("unauthorized")

    await sio.save_session(sid, {"user_id": str(user.id)})
    await sio.enter_room(sid, f"user:{user.id}")
    for project_id in await _project_ids(user):
        await sio.enter_room(sid, f"project:{project_id}")


@sio.event
async def disconnect(sid):
    pass


@sio.on("join:project")
async def join_project(sid, data):
    """Подписка на проект, в который пользователя добавили уже после подключения."""
    project_id = (data or {}).get("projectId")
    if not project_id:
        return
    session = await sio.get_session(sid)
    async with async_session_factory() as db:
        user = (await db.execute(select(User).where(User.id == session["user_id"]))).scalar_one_or_none()
        if user is None or await get_project_role(db, project_id, user) is None:
            return
    await sio.enter_room(sid, f"project:{project_id}")


@sio.on("leave:project")
async def leave_project(sid, data):
    project_id = (data or {}).get("projectId")
    if project_id:
        await sio.leave_room(sid, f"project:{project_id}")


from datetime import datetime
from uuid import UUID

def _json_safe(data):
    if isinstance(data, dict):
        return {k: _json_safe(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_json_safe(v) for v in data]
    elif isinstance(data, UUID):
        return str(data)
    elif isinstance(data, datetime):
        return data.isoformat()
    elif hasattr(data, "isoformat"):  # handles date as well
        return data.isoformat()
    return data


# ─── Server-side emit helpers (called from API routes) ─────

async def emit_task_created(project_id: str, task: dict):
    await sio.emit("task:created", _json_safe(task), room=f"project:{project_id}")


async def emit_task_updated(project_id: str, task: dict):
    await sio.emit("task:updated", _json_safe(task), room=f"project:{project_id}")


async def emit_task_deleted(project_id: str, task_id: str):
    await sio.emit("task:deleted", {"taskId": task_id}, room=f"project:{project_id}")


async def emit_project_updated(project_id: str, project: dict):
    await sio.emit("project:updated", _json_safe(project), room=f"project:{project_id}")


async def emit_notification(user_id: str, notification: dict):
    await sio.emit("notification:new", _json_safe(notification), room=f"user:{user_id}")
