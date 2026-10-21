import pytest

@pytest.mark.asyncio
async def test_member_cannot_delete_project(client, member_headers, project_id):
    # Member attempts to delete project
    r = await client.delete(f"/api/projects/{project_id}", headers=member_headers)
    assert r.status_code == 403
    assert "Недостаточно прав" in r.json()["detail"]

@pytest.mark.asyncio
async def test_member_cannot_invite_others(client, member_headers, project_id):
    # Member attempts to create invitation
    inv_data = {"project_id": project_id, "role": "member"}
    r = await client.post(f"/api/projects/{project_id}/invitations", json=inv_data, headers=member_headers)
    assert r.status_code == 403

@pytest.mark.asyncio
async def test_member_cannot_directly_close_task(client, auth_headers, member_headers, project_id):
    # 1. Admin creates task and assigns to member
    # Need to get member user id
    me_r = await client.get("/api/auth/me", headers=member_headers)
    member_id = me_r.json()["id"]

    task_data = {
        "title": "Review Required Task",
        "project_id": project_id,
        "assignee_id": member_id,
        "status": "todo"
    }
    task_r = await client.post("/api/tasks", json=task_data, headers=auth_headers)
    task_id = task_r.json()["id"]

    # 2. Member tries to set status to 'done' directly via PATCH
    patch_data = {"status": "done"}
    patch_r = await client.patch(f"/api/tasks/{task_id}", json=patch_data, headers=member_headers)
    
    assert patch_r.status_code == 403
    assert "Вы не можете самостоятельно закрыть задачу" in patch_r.json()["detail"]

    # 3. Member submits for review (allowed)
    review_r = await client.post(f"/api/tasks/{task_id}/submit-review", headers=member_headers)
    assert review_r.status_code == 200
    assert review_r.json()["status"] == "pending_review"

    # 4. Admin approves (allowed)
    approve_r = await client.post(f"/api/tasks/{task_id}/approve", headers=auth_headers)
    assert approve_r.status_code == 200
    assert approve_r.json()["status"] == "done"

@pytest.mark.asyncio
async def test_member_cannot_edit_other_task(client, auth_headers, member_headers, project_id):
    # 1. Admin creates task and assigns to NO ONE (or himself)
    task_data = {
        "title": "Admin Task",
        "project_id": project_id,
        "status": "todo"
    }
    task_r = await client.post("/api/tasks", json=task_data, headers=auth_headers)
    task_id = task_r.json()["id"]

    # 2. Member tries to edit it
    patch_data = {"title": "Hacked Title"}
    patch_r = await client.patch(f"/api/tasks/{task_id}", json=patch_data, headers=member_headers)
    
    assert patch_r.status_code == 403
    assert "Недостаточно прав для редактирования" in patch_r.json()["detail"]
