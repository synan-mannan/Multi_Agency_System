from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import log
from ..db import system_engine
from ..deps import Principal, admin_only, get_conn
from ..security import hash_password, token_hash

router = APIRouter(prefix="/invites", tags=["invites"])


class InviteCreate(BaseModel):
    email: str
    role: Literal["agency_admin", "agency_member", "client_user"]
    client_id: UUID | None = None


class InviteAccept(BaseModel):
    token: str
    full_name: str
    password: str


@router.post("")
def create_invite(body: InviteCreate, p: Principal = Depends(admin_only),
                  conn: Connection = Depends(get_conn)):
    if (body.role == "client_user") != (body.client_id is not None):
        raise HTTPException(422, "client_id is required only for client users")
    if body.client_id is not None:
        client = conn.execute(text("SELECT 1 FROM clients WHERE id = :id AND agency_id = :aid"),
                              {"id": body.client_id, "aid": p.agency_id}).first()
        if client is None:
            raise HTTPException(404, "Client not found")
    token = uuid4().hex + uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    row = conn.execute(text("""
        INSERT INTO invites (agency_id, email, role, client_id, token_hash, expires_at, invited_by)
        VALUES (:aid, :email, :role, :client_id, :hash, :expires, :mid)
        ON CONFLICT (agency_id, email, role, client_key) WHERE status = 'pending'
        DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at
        RETURNING id
    """), {"aid": p.agency_id, "email": body.email, "role": body.role,
           "client_id": body.client_id, "hash": token_hash(token), "expires": expires,
           "mid": p.membership_id}).mappings().one()
    log(conn, p, "invite.created", {"invite_id": str(row["id"])})
    return {"invite_id": row["id"], "token": token, "expires_at": expires}


@router.get("")
def list_invites(p: Principal = Depends(admin_only), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text("""
        SELECT id, agency_id, email, role, client_id, status,
               expires_at - interval '7 days' AS created_at, expires_at
        FROM invites WHERE agency_id = :aid ORDER BY expires_at DESC
    """), {"aid": p.agency_id}).mappings().all()
    return [dict(row) for row in rows]


@router.post("/{invite_id}/resend")
def resend_invite(invite_id: UUID, p: Principal = Depends(admin_only),
                  conn: Connection = Depends(get_conn)):
    token = uuid4().hex + uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    row = conn.execute(text("""
        UPDATE invites SET token_hash = :hash, expires_at = :expires
        WHERE id = :id AND agency_id = :aid AND status = 'pending'
        RETURNING id
    """), {"hash": token_hash(token), "expires": expires, "id": invite_id, "aid": p.agency_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Pending invite not found")
    log(conn, p, "invite.resent", {"invite_id": str(invite_id)})
    return {"invite_id": row["id"], "token": token, "expires_at": expires}


@router.delete("/{invite_id}")
def revoke_invite(invite_id: UUID, p: Principal = Depends(admin_only),
                  conn: Connection = Depends(get_conn)):
    row = conn.execute(text("""
        UPDATE invites SET status = 'revoked'
        WHERE id = :id AND agency_id = :aid AND status = 'pending'
        RETURNING id
    """), {"id": invite_id, "aid": p.agency_id}).first()
    if row is None:
        raise HTTPException(404, "Pending invite not found")
    log(conn, p, "invite.revoked", {"invite_id": str(invite_id)})
    return {"revoked": True}


@router.post("/accept")
def accept_invite(body: InviteAccept):
    hashed = token_hash(body.token)
    with system_engine.begin() as conn:
        invite = conn.execute(text("""
            UPDATE invites SET status = 'accepted', accepted_at = now()
            WHERE token_hash = :hash AND status = 'pending' AND expires_at > now()
            RETURNING id, agency_id, email, role, client_id
        """), {"hash": hashed}).mappings().first()
        if invite is None:
            raise HTTPException(409, "Invite is invalid, expired, or already used")
        user = conn.execute(text("""
            INSERT INTO users (email, password_hash, full_name)
            VALUES (:email, :password_hash, :full_name)
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id
        """), {"email": invite["email"], "password_hash": hash_password(body.password),
               "full_name": body.full_name}).mappings().one()
        member = conn.execute(text("""
            INSERT INTO memberships (agency_id, user_id, role, client_id)
            VALUES (:aid, :uid, :role, :client_id)
            ON CONFLICT (user_id, agency_id) DO NOTHING
            RETURNING id
        """), {"aid": invite["agency_id"], "uid": user["id"], "role": invite["role"],
               "client_id": invite["client_id"]}).mappings().first()
        if member is None:
            member = conn.execute(text("""
                SELECT id FROM memberships WHERE agency_id = :aid AND user_id = :uid
            """), {"aid": invite["agency_id"], "uid": user["id"]}).mappings().one()
    return {"accepted": True, "user_id": user["id"], "membership_id": member["id"]}
