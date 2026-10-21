"""Socket.IO: подключение только с токеном, комнаты — только свои проекты."""
import pytest
import socketio

import app.socket.handlers as ws


@pytest.fixture
def rooms(monkeypatch, session_factory):
    """Перехватываем работу с комнатами и сессией вместо настоящего сервера."""
    joined: dict[str, set[str]] = {}
    sessions: dict[str, dict] = {}

    async def enter_room(sid, room, namespace=None):
        joined.setdefault(sid, set()).add(room)

    async def save_session(sid, data, namespace=None):
        sessions[sid] = data

    async def get_session(sid, namespace=None):
        return sessions[sid]

    monkeypatch.setattr(ws, "async_session_factory", session_factory)
    monkeypatch.setattr(ws.sio, "enter_room", enter_room)
    monkeypatch.setattr(ws.sio, "save_session", save_session)
    monkeypatch.setattr(ws.sio, "get_session", get_session)
    return joined


def _token(headers):
    return headers["Authorization"].split()[1]


async def test_connect_without_token_refused(rooms):
    with pytest.raises(socketio.exceptions.ConnectionRefusedError):
        await ws.connect("sid-1", {}, None)
    with pytest.raises(socketio.exceptions.ConnectionRefusedError):
        await ws.connect("sid-2", {}, {"token": "garbage"})


async def test_member_joins_only_own_rooms(client, rooms, member_headers, outsider_headers, project_id):
    me = (await client.get("/api/auth/me", headers=member_headers)).json()
    await ws.connect("sid-m", {}, {"token": _token(member_headers)})
    assert rooms["sid-m"] == {f"user:{me['id']}", f"project:{project_id}"}


async def test_outsider_cannot_join_foreign_project(client, rooms, outsider_headers, project_id):
    await ws.connect("sid-o", {}, {"token": _token(outsider_headers)})
    before = set(rooms["sid-o"])
    await ws.join_project("sid-o", {"projectId": project_id})
    assert rooms["sid-o"] == before
    assert f"project:{project_id}" not in rooms["sid-o"]


async def test_admin_joins_all_projects(client, rooms, auth_headers, project_id, outsider_headers):
    await ws.connect("sid-a", {}, {"token": _token(auth_headers)})
    project_rooms = {r for r in rooms["sid-a"] if r.startswith("project:")}
    assert len(project_rooms) == 2
