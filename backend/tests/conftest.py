import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import api_app
from app.db.models import Base
from app.core.dependencies import get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

import app.cache.redis as redis_module

class MockRedis:
    async def get(self, key): return None
    async def set(self, key, value, ex=None): pass
    async def delete(self, *keys): pass
    async def scan_iter(self, match=None):
        if False: yield
    async def close(self): pass

async def mock_get_redis(*args, **kwargs):
    return MockRedis()

redis_module.get_redis = mock_get_redis

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

@pytest.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

api_app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
async def client():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def admin_token(client):
    setup_data = {
        "name": "Admin Test",
        "email": "admin_fixture@test.com",
        "password": "pass",
        "initials": "AT"
    }
    resp = await client.post("/api/auth/setup", json=setup_data)
    if resp.status_code == 200:
        return resp.json()["access_token"]
    
    # If already set up in this session by some chance or previous insert
    login_data = {"email": "admin_fixture@test.com", "password": "pass"}
    login_resp = await client.post("/api/auth/login", json=login_data)
    return login_resp.json()["access_token"]

@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
async def project_id(client, auth_headers):
    proj_data = {"name": "Test Project", "priority": "high", "status": "planning", "color": "#000"}
    r = await client.post("/api/projects", json=proj_data, headers=auth_headers)
    return r.json()["id"]

@pytest.fixture
async def member_token(client, auth_headers, project_id):
    # 1. Admin creates invite
    inv_data = {"project_id": project_id, "role": "member"}
    inv_r = await client.post(f"/api/projects/{project_id}/invitations", json=inv_data, headers=auth_headers)
    token = inv_r.json()["token"]
    
    # 2. Member registers via invite
    reg_data = {
        "name": "Member User",
        "email": "member@test.com",
        "password": "pass",
        "initials": "MU"
    }
    reg_r = await client.post(f"/api/invite/{token}/register", json=reg_data)
    return reg_r.json()["access_token"]

@pytest.fixture
def member_headers(member_token):
    return {"Authorization": f"Bearer {member_token}"}
