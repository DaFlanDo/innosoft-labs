"""Статика: наружу отдаётся только собранный фронт, а не файлы проекта."""
import pytest


@pytest.mark.parametrize("path,secret", [
    ("/backend/.env", "JWT_SECRET_KEY"),
    ("/backend/.env.example", "JWT_SECRET_KEY"),
    ("/backend/app/core/config.py", "BaseSettings"),
    ("/README.md", "## "),
])
async def test_project_files_not_served(client, path, secret):
    # Либо 404 (фронт не собран), либо index.html приложения — но не сам файл
    r = await client.get(path)
    assert r.status_code == 404 or 'id="root"' in r.text, f"{path} отдаётся наружу"
    assert secret not in r.text


async def test_api_still_works(client):
    assert (await client.get("/api/health")).json() == {"status": "ok"}
