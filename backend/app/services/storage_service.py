"""Storage service — MinIO file upload for avatars and attachments."""

from datetime import timedelta
from io import BytesIO
from urllib.parse import urlparse

from minio import Minio

from app.core.config import get_settings

settings = get_settings()

_client: Minio | None = None


import json

def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
        # Ensure bucket exists
        if not _client.bucket_exists(settings.MINIO_BUCKET):
            _client.make_bucket(settings.MINIO_BUCKET)
            
        # Set public policy for docs and avatars
        try:
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": ["*"]},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"]
                    }
                ]
            }
            _client.set_bucket_policy(settings.MINIO_BUCKET, json.dumps(policy))
        except Exception as e:
            print(f"Warning: Could not set MinIO policy: {e}")
        
    return _client


def upload_file(object_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload a file to MinIO and return the object URL."""
    client = get_minio_client()
    stream = BytesIO(data)
    client.put_object(
        settings.MINIO_BUCKET,
        object_name,
        stream,
        length=len(data),
        content_type=content_type,
    )
    return f"{_public_base()}/{settings.MINIO_BUCKET}/{object_name}"


def _public_base() -> str:
    return (settings.MINIO_PUBLIC_URL or f"http://{settings.MINIO_ENDPOINT}").rstrip("/")


_public_client: Minio | None = None


def _get_public_client() -> Minio:
    """Клиент с публичным адресом — только для подписи ссылок (без сетевых запросов:
    регион задан явно, поэтому presign считается локально)."""
    global _public_client
    if _public_client is None:
        parsed = urlparse(_public_base())
        _public_client = Minio(
            parsed.netloc,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=parsed.scheme == "https",
            region="us-east-1",
        )
    return _public_client


def get_presigned_url(object_name: str, expires_seconds: int = 3600) -> str:
    """Generate a time-limited presigned GET URL for a stored object."""
    client = _get_public_client()
    return client.presigned_get_object(
        settings.MINIO_BUCKET,
        object_name,
        expires=timedelta(seconds=expires_seconds),
    )


def object_name_from_url(url: str) -> str | None:
    """Extract the MinIO object name from a stored file URL."""
    # Старые записи могли сохраниться с внутренним адресом MinIO
    for base in (_public_base(), f"http://{settings.MINIO_ENDPOINT}"):
        prefix = f"{base}/{settings.MINIO_BUCKET}/"
        if url.startswith(prefix):
            return url[len(prefix):]
    return None


def delete_file(object_name: str):
    client = get_minio_client()
    client.remove_object(settings.MINIO_BUCKET, object_name)
