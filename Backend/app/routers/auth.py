from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from ..config import settings
from ..db import system_engine
from ..deps import Principal, admin_only, get_conn, get_principal
from ..security import issue_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


class Login(BaseModel):
    email: str
    password: str
    portal: bool


class SelectWorkspace(BaseModel):
    membership_id: UUID


class ProfileUpdate(BaseModel):
    full_name: str


class AgencyUpdate(BaseModel):
    agency_name: str


@router.post("/login")
def login(body: Login):
    with system_engine.begin() as conn:
        user = conn.execute(text("SELECT id, password_hash FROM users WHERE email = :email"),
                            {"email": body.email}).mappings().first()
        if user is None or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(401, "Invalid email or password")
        workspaces = conn.execute(text("""
            SELECT m.id AS membership_id, m.agency_id, a.name AS agency_name, m.role, m.client_id
            FROM memberships m JOIN agencies a ON a.id = m.agency_id
            WHERE m.user_id = :uid AND m.status = 'active'
              AND (m.role = 'client_user') = :portal
            ORDER BY a.name
        """), {"uid": user["id"], "portal": body.portal}).mappings().all()
    if not workspaces:
        raise HTTPException(403, "No workspaces available for this portal")
    token = issue_token({"sub": str(user["id"]), "scope": "identity"}, settings.identity_ttl_minutes)
    return {"identity_token": token, "workspaces": [dict(w) for w in workspaces]}


@router.post("/select-workspace")
def select_workspace(body: SelectWorkspace,
                     credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(401, "Identity token required")
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        if claims.get("scope") != "identity":
            raise ValueError("wrong token scope")
        user_id = UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Invalid identity token") from None
    with system_engine.begin() as conn:
        row = conn.execute(text("""
            SELECT id, agency_id, role, client_id FROM memberships
            WHERE id = :mid AND user_id = :uid AND status = 'active'
        """), {"mid": body.membership_id, "uid": user_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Workspace not found")
    token = issue_token({
        "sub": str(user_id), "mid": str(row["id"]), "aid": str(row["agency_id"]),
        "role": row["role"], "cid": str(row["client_id"]) if row["client_id"] else None,
        "scope": "workspace",
    }, settings.workspace_ttl_minutes)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(p: Principal = Depends(get_principal), conn=Depends(get_conn)):
    row = conn.execute(text("""
        SELECT u.email, u.full_name, a.name AS agency_name
        FROM users u JOIN agencies a ON a.id = :aid
        WHERE u.id = :uid
    """), {"aid": p.agency_id, "uid": p.user_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "User not found")
    return {
        "user_id": p.user_id,
        "membership_id": p.membership_id,
        "agency_id": p.agency_id,
        "agency_name": row["agency_name"],
        "role": p.role,
        "client_id": p.client_id,
        "email": row["email"],
        "full_name": row["full_name"],
    }


@router.patch("/me")
def update_me(body: ProfileUpdate, p: Principal = Depends(get_principal),
              conn=Depends(get_conn)):
    full_name = body.full_name.strip()
    if not full_name:
        raise HTTPException(422, "Display name cannot be empty")
    updated = conn.execute(text("""
        UPDATE users SET full_name = :full_name WHERE id = :uid RETURNING id
    """), {"full_name": full_name, "uid": p.user_id}).first()
    if updated is None:
        raise HTTPException(404, "User not found")
    return me(p, conn)


@router.patch("/agency")
def update_agency(body: AgencyUpdate, p: Principal = Depends(admin_only),
                  conn=Depends(get_conn)):
    agency_name = body.agency_name.strip()
    if not agency_name:
        raise HTTPException(422, "Agency name cannot be empty")
    row = conn.execute(text("""
        UPDATE agencies SET name = :name WHERE id = :aid RETURNING id, name
    """), {"name": agency_name, "aid": p.agency_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Agency not found")
    return {"agency_id": row["id"], "agency_name": row["name"]}
