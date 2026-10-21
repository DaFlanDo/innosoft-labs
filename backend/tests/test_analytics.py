import pytest

@pytest.mark.asyncio
async def test_analytics(client, auth_headers):
    # Summary
    r1 = await client.get("/api/analytics/summary", headers=auth_headers)
    assert r1.status_code == 200
    assert "total_projects" in r1.json()

    # Tasks by project
    r2 = await client.get("/api/analytics/tasks-by-project", headers=auth_headers)
    assert r2.status_code == 200

    # Team performance
    r3 = await client.get("/api/analytics/team-performance", headers=auth_headers)
    assert r3.status_code == 200


async def test_summary_counts_real_statuses(client, auth_headers, project_id):
    """«В процессе» и «на проверке» считаются по настоящим статусам задач."""
    for title, status in [("a", "todo"), ("b", "in_progress"), ("c", "in_progress"), ("d", "done")]:
        await client.post("/api/tasks", headers=auth_headers,
                          json={"title": title, "project_id": project_id, "status": status})
    r = await client.get("/api/analytics/summary", headers=auth_headers)
    data = r.json()
    assert data["total_tasks"] == 4
    assert data["in_progress_tasks"] == 2
    assert data["completed_tasks"] == 1
    assert data["review_tasks"] == 0
