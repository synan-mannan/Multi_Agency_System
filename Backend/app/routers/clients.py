from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..deps import Principal, admin_only, get_conn

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("")
def list_clients(p: Principal = Depends(admin_only), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text("""
        SELECT c.id, c.agency_id, c.org_name,
               string_agg(DISTINCT u.full_name, ', ' ORDER BY u.full_name) AS contact_name,
               string_agg(DISTINCT u.email::text, ', ' ORDER BY u.email::text) AS contact_email
        FROM clients c
        LEFT JOIN memberships m ON m.client_id = c.id AND m.agency_id = c.agency_id
          AND m.status = 'active'
        LEFT JOIN users u ON u.id = m.user_id
        WHERE c.agency_id = :aid
        GROUP BY c.id, c.agency_id, c.org_name
        ORDER BY c.org_name
    """), {"aid": p.agency_id}).mappings().all()
    return [dict(row) for row in rows]
