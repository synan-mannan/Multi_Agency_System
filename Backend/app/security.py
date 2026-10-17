import hashlib
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from .config import settings

hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, encoded: str | None) -> bool:
    if encoded is None:
        return False
    try:
        return hasher.verify(encoded, password)
    except VerifyMismatchError:
        return False


def issue_token(claims: dict, minutes: int) -> str:
    payload = {**claims, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
