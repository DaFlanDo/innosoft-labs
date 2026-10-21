import pytest

@pytest.fixture
async def project_id(client, auth_headers):
    proj_data = {
        "name": "Task Test Project",
        "description": "Desc",
        "status": "planning",
        "priority": "high",
        "color": "#111"
    }
    resp = await client.post("/api/projects", json=proj_data, headers=auth_headers)
    return resp.json()["id"]

@pytest.mark.asyncio
async def test_crud_task(client, auth_headers, project_id):
    # 1. Create Task
    task_data = {
        "title": "First Test Task",
        "description": "It should work",
        "priority": "high",
        "project_id": project_id
    }
    create_resp = await client.post("/api/tasks", json=task_data, headers=auth_headers)
    assert create_resp.status_code == 201
    task_id = create_resp.json()["id"]
    assert create_resp.json()["title"] == "First Test Task"

    # 2. Get Task Route (Project Tasks)
    list_resp = await client.get(f"/api/projects/{project_id}/tasks", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 3. Update Task
    update_data = {"title": "Updated Task", "status": "in_progress"}
    patch_resp = await client.patch(f"/api/tasks/{task_id}", json=update_data, headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Updated Task"
    assert patch_resp.json()["status"] == "in_progress"

    # 4. Create Comment
    comment_data = {"content": "Test comment"}
    comment_resp = await client.post(f"/api/tasks/{task_id}/comments", json=comment_data, headers=auth_headers)
    assert comment_resp.status_code == 201

    # 5. List comments
    comments_list = await client.get(f"/api/tasks/{task_id}/comments", headers=auth_headers)
    assert comments_list.status_code == 200
    assert len(comments_list.json()) == 1

    # 6. Submit task for review
    review_resp = await client.post(f"/api/tasks/{task_id}/submit-review", headers=auth_headers)
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "pending_review"

    # 7. Approve task
    approve_resp = await client.post(f"/api/tasks/{task_id}/approve", headers=auth_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "done"

    # 8. Delete Task
    del_resp = await client.delete(f"/api/tasks/{task_id}", headers=auth_headers)
    assert del_resp.status_code == 204
