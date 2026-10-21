import pytest

@pytest.mark.asyncio
async def test_setup_admin(client):
    # Try setup
    setup_data = {
        "name": "Test Admin",
        "email": "admin@test.com",
        "password": "strongpassword",
        "initials": "TA"
    }
    response = await client.post("/api/auth/setup", json=setup_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@test.com"
    assert data["user"]["system_role"] == "admin"

    # Try setup again - should fail
    response2 = await client.post("/api/auth/setup", json=setup_data)
    assert response2.status_code == 403
    assert response2.json()["detail"] == "System already initialized"

@pytest.mark.asyncio
async def test_login(client):
    # Setup first
    setup_data = {
        "name": "Test Admin2",
        "email": "admin2@test.com",
        "password": "strongpassword",
        "initials": "TA"
    }
    await client.post("/api/auth/setup", json=setup_data)
    
    # Login
    login_data = {"email": "admin2@test.com", "password": "strongpassword"}
    response = await client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # Wrong password
    login_data_wrong = {"email": "admin2@test.com", "password": "wrong"}
    response_wrong = await client.post("/api/auth/login", json=login_data_wrong)
    assert response_wrong.status_code == 401
