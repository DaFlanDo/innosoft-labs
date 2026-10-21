"""Доступ к данным: без токена ничего не отдаётся, чужие проекты закрыты."""
import pytest


@pytest.mark.parametrize("url", [
    "/api/users",
    "/api/analytics/summary",
    "/api/analytics/tasks-by-project",
    "/api/analytics/team-performance",
])
async def test_requires_token(client, url):
    r = await client.get(url)
    assert r.status_code in (401, 403)


async def test_user_profile_requires_token(client, auth_headers):
    me = (await client.get("/api/auth/me", headers=auth_headers)).json()
    assert (await client.get(f"/api/users/{me['id']}")).status_code in (401, 403)
    assert (await client.get(f"/api/users/{me['id']}/stats")).status_code in (401, 403)


async def test_logged_in_user_sees_team(client, member_headers):
    r = await client.get("/api/users", headers=member_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 2


async def test_member_cannot_see_company_analytics(client, member_headers):
    r = await client.get("/api/analytics/summary", headers=member_headers)
    assert r.status_code == 403


async def test_admin_sees_analytics(client, auth_headers):
    r = await client.get("/api/analytics/summary", headers=auth_headers)
    assert r.status_code == 200
