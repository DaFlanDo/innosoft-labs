"""Application configuration loaded from .env via pydantic-settings."""

from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+aiomysql://innosoft:innosoft_secret@localhost:3306/innosoft?charset=utf8mb4"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "innosoft"
    # Адрес MinIO для браузера (ссылки на файлы). Внутри Docker backend ходит
    # в minio:9000, а браузеру нужен, например, http://localhost:9000
    MINIO_PUBLIC_URL: str = ""

    # App
    APP_PORT: int = 8000
    DEBUG: bool = True
    # Демо-пользователи и проекты при пустой базе. В проде — выключено:
    # у демо-админа известный пароль
    SEED_DEMO: bool = False

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def _jwt_secret_must_be_set(cls, value: str) -> str:
        # С ключом из кода любой, кто видел репозиторий, выпустит себе токен админа
        if not value or "change-me" in value:
            raise ValueError("JWT_SECRET_KEY не задан. Сгенерируйте: openssl rand -hex 32 и пропишите в backend/.env")
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()
