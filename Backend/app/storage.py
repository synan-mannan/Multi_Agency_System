from pathlib import Path
from uuid import uuid4

from .config import settings


def save(data: bytes) -> str:
    key = uuid4().hex
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / key).write_bytes(data)
    return key


def file_path(key: str) -> Path:
    return Path(settings.storage_dir) / key


def delete(key: str) -> None:
    file_path(key).unlink(missing_ok=True)
