import pytest
import datetime

@pytest.fixture
async def project_id(client, auth_headers):
    proj_data = {"name": "Test Invite Project", "priority": "high", "status": "planning", "color": "#000"}
    r = await client.post("/api/projects", json=proj_data, headers=auth_headers)
    return r.json()["id"]

@pytest.mark.asyncio
async def test_create_and_list_invitations(client, auth_headers, project_id):
    # Create invitation
    inv_data = {
        "invite_type": "project",
        "project_id": project_id,
        "role": "member",
        "max_uses": 2,
        "expires_in_hours": 24
    }
    r = await client.post(f"/api/projects/{project_id}/invitations", json=inv_data, headers=auth_headers)
    assert r.status_code == 201
    
    invitation = r.json()
    assert invitation["token"] is not None
    assert invitation["role"] == "member"
    assert invitation["invite_url"] is not None

    inv_id = invitation["id"]

    # List invitations
    list_r = await client.get(f"/api/projects/{project_id}/invitations", headers=auth_headers)
    assert list_r.status_code == 200
    assert len(list_r.json()) >= 1

    # Get invite public info
    token = invitation["token"]
    info_r = await client.get(f"/api/invite/{token}")
    assert info_r.status_code == 200
    assert info_r.json()["project_name"] == "Test Invite Project"
    
    # Deactivate
    del_r = await client.delete(f"/api/projects/{project_id}/invitations/{inv_id}", headers=auth_headers)
    assert del_r.status_code == 204
