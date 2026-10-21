"""Комментарии и вложения: только участники проекта задачи."""
import io

import pytest

import app.api.tasks as tasks_api
import app.services.task_service as task_service


@pytest.fixture(autouse=True)
def fake_storage(monkeypatch):
    # MinIO в тестах нет — подменяем загрузку и подписанные ссылки
    monkeypatch.setattr(tasks_api, "upload_file", lambda name, data, ct: f"http://minio/{name}")
    monkeypatch.setattr(tasks_api, "get_presigned_url", lambda name: f"http://minio/{name}?signed")
    monkeypatch.setattr(task_service, "_presigned", lambda url: url)


@pytest.fixture
async def task_id(client, auth_headers, member_headers, project_id):
    me = (await client.get("/api/auth/me", headers=member_headers)).json()
    r = await client.post("/api/tasks", headers=auth_headers, json={
        "title": "Задача с вложениями", "project_id": project_id, "assignee_id": me["id"],
    })
    return r.json()["id"]


def _file(name="report.txt"):
    return {"file": (name, io.BytesIO(b"hello"), "text/plain")}


async def test_member_comments_and_reads(client, member_headers, task_id):
    r = await client.post(f"/api/tasks/{task_id}/comments", headers=member_headers, json={"content": "Готово"})
    assert r.status_code == 201
    r = await client.get(f"/api/tasks/{task_id}/comments", headers=member_headers)
    assert [c["content"] for c in r.json()] == ["Готово"]


async def test_outsider_cannot_read_or_write_comments(client, outsider_headers, task_id):
    assert (await client.get(f"/api/tasks/{task_id}/comments", headers=outsider_headers)).status_code == 403
    r = await client.post(f"/api/tasks/{task_id}/comments", headers=outsider_headers, json={"content": "спам"})
    assert r.status_code == 403


async def test_outsider_cannot_touch_attachments(client, outsider_headers, task_id):
    assert (await client.get(f"/api/tasks/{task_id}/attachments", headers=outsider_headers)).status_code == 403
    r = await client.post(f"/api/tasks/{task_id}/attachments", headers=outsider_headers, files=_file())
    assert r.status_code == 403


async def test_comment_on_missing_task_is_404(client, member_headers):
    r = await client.post("/api/tasks/00000000-0000-0000-0000-000000000000/comments",
                          headers=member_headers, json={"content": "?"})
    assert r.status_code == 404


async def test_member_uploads_and_deletes_own_attachment(client, member_headers, task_id):
    up = await client.post(f"/api/tasks/{task_id}/attachments", headers=member_headers, files=_file())
    assert up.status_code == 201
    att_id = up.json()["id"]
    r = await client.delete(f"/api/tasks/{task_id}/attachments/{att_id}", headers=member_headers)
    assert r.status_code == 204


async def test_member_cannot_delete_managers_attachment(client, auth_headers, member_headers, task_id):
    up = await client.post(f"/api/tasks/{task_id}/attachments", headers=auth_headers, files=_file("tz.pdf"))
    att_id = up.json()["id"]
    r = await client.delete(f"/api/tasks/{task_id}/attachments/{att_id}", headers=member_headers)
    assert r.status_code == 403
