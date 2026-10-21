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
