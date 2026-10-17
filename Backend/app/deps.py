from dataclasses import dataclass
from typing import Iterator
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import engine
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    membership_id: UUID
    agency_id: UUID
    role: str
    client_id: UUID | None


def get_principal(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    try:
        claims = decode_token(credentials.credentials)
        if claims.get("scope") != "workspace":
            raise ValueError("wrong token scope")
        user_id, membership_id, agency_id = (UUID(claims[k]) for k in ("sub", "mid", "aid"))
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Invalid workspace token") from None
    with engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.agency_id', :v, true)"), {"v": str(agency_id)})
        row = conn.execute(text("""
            SELECT role, client_id FROM memberships
            WHERE id = :mid AND user_id = :uid AND agency_id = :aid AND status = 'active'
        """), {"mid": membership_id, "uid": user_id, "aid": agency_id}).mappings().first()
    expected_client = str(row["client_id"]) if row and row["client_id"] else None
    if row is None or row["role"] != claims.get("role") or expected_client != claims.get("cid"):
        raise HTTPException(401, "Membership is no longer active")
    return Principal(user_id, membership_id, agency_id, row["role"], row["client_id"])


def get_conn(principal: Principal = Depends(get_principal)) -> Iterator[Connection]:
    with engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.agency_id', :v, true)"), {"v": str(principal.agency_id)})
        yield conn


def agency_only(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.role == "client_user":
        raise HTTPException(403, "Agency access required")
    return principal


def admin_only(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.role != "agency_admin":
        raise HTTPException(403, "Administrator access required")
    return principal
