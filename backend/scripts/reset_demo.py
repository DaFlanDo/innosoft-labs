"""Возвращает демо-стенд к исходным данным: удаляет таблицы, файлы в MinIO
и кэш в Redis, затем прогоняет миграции и сид заново.

На сервере запускается по cron раз в сутки:
  docker compose -p innosoft exec -T app python scripts/reset_demo.py
Без DEMO_MODE=true отказывается работать — чтобы случайно не стереть живую базу.
"""

import asyncio
import os
import subprocess
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import MetaData, text  # noqa: E402

from app.cache.redis import cache_invalidate_pattern, close_redis  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.database import engine  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.services.storage_service import get_minio_client  # noqa: E402

settings = get_settings()


def _drop_all(conn) -> None:
    # Вместе с alembic_version — миграции прогонятся с нуля
    meta = MetaData()
    meta.reflect(bind=conn)
    if conn.dialect.name == "mysql":
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    meta.drop_all(bind=conn)
    if conn.dialect.name == "mysql":
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))


def _clear_bucket() -> int:
    client = get_minio_client()
    objects = list(client.list_objects(settings.MINIO_BUCKET, recursive=True))
    for obj in objects:
        client.remove_object(settings.MINIO_BUCKET, obj.object_name)
    return len(objects)


async def main() -> None:
    if not settings.DEMO_MODE:
        sys.exit("reset_demo.py работает только при DEMO_MODE=true")

    async with engine.begin() as conn:
        await conn.run_sync(_drop_all)
    await engine.dispose()
    print("✓ База очищена")

    print(f"✓ Файлов удалено из MinIO: {_clear_bucket()}")

    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND_DIR, check=True)
    await seed()

    # Аналитика закэширована на 5 минут — иначе покажет данные до сброса
    await cache_invalidate_pattern("analytics:*")
    await close_redis()
    await engine.dispose()
    print("✓ Демо-стенд сброшен")


if __name__ == "__main__":
    asyncio.run(main())
