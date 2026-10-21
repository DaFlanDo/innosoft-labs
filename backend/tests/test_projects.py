import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_and_list_project(client: AsyncClient):
    # Setup admin
    setup_data = {
        "name": "Admin",
        "email": "admin_proj@test.com",
        "password": "pass",
        "initials": "AD"
    }
    resp = await client.post("/api/auth/setup", json=setup_data)
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create project
    proj_data = {
        "name": "Test Project",
        "description": "My test definition",
        "status": "planning",
        "priority": "high",
        "color": "#000000"
    }
    create_resp = await client.post("/api/projects", json=proj_data, headers=headers)
    assert create_resp.status_code == 201
    proj = create_resp.json()
    assert proj["name"] == "Test Project"

    # List projects
    list_resp = await client.get("/api/projects", headers=headers)
    assert list_resp.status_code == 200
    projs = list_resp.json()
    assert len(projs) > 0
    assert projs[0]["name"] == "Test Project"

@pytest.mark.asyncio
async def test_project_members(client, auth_headers, project_id):
    # Create a member through setup or reuse existing
    # Let's create another user first
    setup_data = {"name": "User2", "email": "u2@test.com", "password": "p", "initials": "U2"}
    # Use login to bypass setup logic if it was used once
    # Wait, setup is for FIRST user. So we should use login if admin_fixture is there.
    # Actually register_and_accept is better for members, but admin can just add if user exists.
    
    # List members
    r = await client.get(f"/api/projects/{project_id}/members", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1

@pytest.mark.asyncio
async def test_update_and_delete_project(client, auth_headers, project_id):
    # Update
    patch_data = {"name": "Better Name"}
    r = await client.patch(f"/api/projects/{project_id}", json=patch_data, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Better Name"

    # Delete
    del_r = await client.delete(f"/api/projects/{project_id}", headers=auth_headers)
    assert del_r.status_code == 204

