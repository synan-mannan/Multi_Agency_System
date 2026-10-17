from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import log, params
from ..deps import Principal, admin_only, get_conn

router = APIRouter(prefix="/team", tags=["team"])


@router.get("")
def list_team(p: Principal = Depends(admin_only), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text("""
        SELECT m.id, m.user_id, u.email, u.full_name, m.role, m.client_id, m.status, m.removed_at
        FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.agency_id = :aid ORDER BY u.full_name
    """), {"aid": p.agency_id}).mappings().all()
    return [dict(row) for row in rows]


@router.delete("/{membership_id}")
def remove_member(membership_id: UUID, p: Principal = Depends(admin_only),
                  conn: Connection = Depends(get_conn)):
    member = conn.execute(text("""
        UPDATE memberships SET status = 'removed', removed_at = now()
        WHERE id = :mid AND agency_id = :aid AND status = 'active'
        RETURNING id, user_id
    """), {"mid": membership_id, "aid": p.agency_id}).mappings().first()
    if member is None:
        raise HTTPException(404, "Membership not found")
    conn.execute(text("DELETE FROM project_members WHERE membership_id = :mid AND agency_id = :aid"),
                 {"mid": membership_id, "aid": p.agency_id})
    log(conn, p, "team.member_removed", {"membership_id": str(membership_id)})
    return {"removed": True}
