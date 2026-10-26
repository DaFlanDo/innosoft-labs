"""Демо-стенд: сид, вход без пароля по ролям, защита общих аккаунтов."""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.db.seed as seed_module
from app.core.config import get_settings
from app.core.demo import DEMO_ACCOUNTS
from app.core.dependencies import get_db
from app.core.security import hash_password
from app.db.models import Activity, Comment, Task, User
from app.main import api_app


@pytest.fixture
def demo_mode(monkeypatch):
    monkeypatch.setattr(get_settings(), "DEMO_MODE", True)


@pytest.fixture
async def demo_users():
    """Демо-аккаунты всех ролей плюс один обычный пользователь.
    Пишем через ту же сессию, что и приложение (переопределённый get_db из conftest):
    импорт из tests.conftest создал бы второй экземпляр conftest со своей базой."""
    async for s in api_app.dependency_overrides[get_db]():
        for role, email in [*DEMO_ACCOUNTS.items(), ("member", "regular@test.dev")]:
            s.add(User(id=str(uuid.uuid4()), name=email, email=email, initials="DU",
                       password_hash=hash_password("x"), system_role=role))


async def demo_headers(client, role: str) -> dict[str, str]:
    resp = await client.post("/api/auth/demo", json={"role": role})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def test_seed_fills_demo_content(monkeypatch):
    # Отдельная база, чтобы сид не смешивался с данными остальных тестов
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    sessions = async_sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(seed_module, "engine", engine)
    monkeypatch.setattr(seed_module, "async_session_factory", sessions)
    try:
        await seed_module.seed()
        async with sessions() as s:
            emails = set((await s.execute(select(User.email))).scalars())
            assert set(DEMO_ACCOUNTS.values()) <= emails
            for email in DEMO_ACCOUNTS.values():
                user = (await s.execute(select(User).where(User.email == email))).scalar_one()
                tasks = (await s.execute(select(func.count(Task.id)).where(Task.assignee_id == user.id))).scalar()
                assert tasks > 0, f"у {email} нет задач"
            assert (await s.execute(select(func.count(Comment.id)))).scalar() > 0
            assert (await s.execute(select(func.count(Activity.id)))).scalar() > 0
    finally:
        await engine.dispose()


async def test_demo_login_disabled_by_default(client, demo_users, monkeypatch):
    monkeypatch.setattr(get_settings(), "DEMO_MODE", False)
    assert (await client.get("/api/auth/demo")).json()["enabled"] is False
    assert (await client.post("/api/auth/demo", json={"role": "admin"})).status_code == 404


@pytest.mark.parametrize("role", ["admin", "manager", "member"])
async def test_demo_login_for_each_role(client, demo_users, demo_mode, role):
    headers = await demo_headers(client, role)
    me = (await client.get("/api/auth/me", headers=headers)).json()
    assert me["email"] == DEMO_ACCOUNTS[role]
    assert me["system_role"] == role


async def test_demo_login_rejects_unknown_role(client, demo_users, demo_mode):
    assert (await client.post("/api/auth/demo", json={"role": "root"})).status_code == 422


async def test_demo_accounts_are_protected(client, demo_users, demo_mode):
    admin = await demo_headers(client, "admin")
    users = {u["email"]: u["id"] for u in (await client.get("/api/users", headers=admin)).json()}
    manager_id = users[DEMO_ACCOUNTS["manager"]]

    r = await client.patch(f"/api/users/{manager_id}/system-role", json={"system_role": "member"}, headers=admin)
    assert r.status_code == 403
    assert (await client.delete(f"/api/users/{manager_id}", headers=admin)).status_code == 403

    # Обычных пользователей демо-режим не защищает
    assert (await client.delete(f"/api/users/{users['regular@test.dev']}", headers=admin)).status_code == 204
