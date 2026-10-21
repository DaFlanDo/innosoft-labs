import pytest

@pytest.mark.asyncio
async def test_get_users(client, auth_headers):
    resp = await client.get("/api/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["email"] == "admin_fixture@test.com"

@pytest.mark.asyncio
async def test_update_me(client, auth_headers):
    update_data = {"name": "Updated Admin Name"}
    resp = await client.patch("/api/users/me", json=update_data, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Admin Name"

@pytest.mark.asyncio
async def test_get_stats(client, auth_headers):
    # first fetch users to get ID
    users_resp = await client.get("/api/users", headers=auth_headers)
    user_id = users_resp.json()[0]["id"]
    
    stats_resp = await client.get(f"/api/users/{user_id}/stats", headers=auth_headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "total_tasks" in stats

@pytest.mark.asyncio
async def test_admin_user_management(client, auth_headers, member_headers):
    # Get member id
    me_resp = await client.get("/api/auth/me", headers=member_headers)
    member_id = me_resp.json()["id"]

    # 1. Update system role
    role_data = {"system_role": "manager", "role": "Senior Dev"}
    r1 = await client.patch(f"/api/users/{member_id}/system-role", json=role_data, headers=auth_headers)
    assert r1.status_code == 200
    assert r1.json()["system_role"] == "manager"

    # 2. Delete user
    r2 = await client.delete(f"/api/users/{member_id}", headers=auth_headers)
    assert r2.status_code == 204

