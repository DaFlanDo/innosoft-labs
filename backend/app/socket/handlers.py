"""WebSocket (python-socketio) event handlers."""

import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    cors_credentials=True,
    logger=True,
    engineio_logger=True,
)


@sio.event
async def connect(sid, environ):
    print(f"[WS] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[WS] Client disconnected: {sid}")


@sio.on("join:project")
async def join_project(sid, data):
    project_id = data.get("projectId")
    if project_id:
        sio.enter_room(sid, f"project:{project_id}")
        print(f"[WS] {sid} joined room project:{project_id}")


@sio.on("leave:project")
async def leave_project(sid, data):
    project_id = data.get("projectId")
    if project_id:
        await sio.leave_room(sid, f"project:{project_id}")
        print(f"[WS] {sid} left room project:{project_id}")


@sio.on("join:user")
async def join_user(sid, data):
    user_id = data.get("userId")
    if user_id:
        await sio.enter_room(sid, f"user:{user_id}")
        print(f"[WS] {sid} joined personal room user:{user_id}")


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
