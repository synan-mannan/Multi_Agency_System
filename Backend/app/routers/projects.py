from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import log, params, project_scope, visible_project
from ..deps import Principal, admin_only, agency_only, get_conn, get_principal

router = APIRouter(tags=["projects"])


class ProjectCreate(BaseModel):
    client_id: UUID
    name: str
    description: str | None = None
    status: str = "active"
    start_date: date | None = None
    due_date: date | None = None


class MembersAdd(BaseModel):
    membership_ids: list[UUID]


@router.get("/projects")
def list_projects(p: Principal = Depends(get_principal), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text(f"""
        SELECT p.*, c.org_name AS client_name
        FROM projects p JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
        WHERE {project_scope(p)} ORDER BY p.created_at DESC
    """),
                        params(p)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/projects/{project_id}")
def get_project(project_id: UUID, p: Principal = Depends(get_principal),
                conn: Connection = Depends(get_conn)):
    visible_project(conn, p, project_id)
    row = conn.execute(text("""
        SELECT p.*, c.org_name AS client_name
        FROM projects p JOIN clients c ON c.id = p.client_id AND c.agency_id = p.agency_id
        WHERE p.id = :id AND p.agency_id = :aid
    """), {"id": project_id, "aid": p.agency_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Project not found")
    return dict(row)


@router.post("/projects", status_code=201)
def create_project(body: ProjectCreate, p: Principal = Depends(admin_only),
                   conn: Connection = Depends(get_conn)):
    client = conn.execute(text("SELECT id FROM clients WHERE id = :id AND agency_id = :aid"),
                          {"id": body.client_id, "aid": p.agency_id}).first()
    if client is None:
        raise HTTPException(404, "Client not found")
    row = conn.execute(text("""
        INSERT INTO projects (agency_id, client_id, name, description, status, start_date, due_date)
        VALUES (:aid, :client_id, :name, :description, :status, :start_date, :due_date) RETURNING *
    """), {**body.model_dump(), "aid": p.agency_id}).mappings().one()
    log(conn, p, "project.created", {"project_id": str(row["id"])})
    return dict(row)


@router.post("/projects/{project_id}/members")
def add_members(project_id: UUID, body: MembersAdd, p: Principal = Depends(admin_only),
                conn: Connection = Depends(get_conn)):
    project = conn.execute(text("SELECT id FROM projects WHERE id = :id AND agency_id = :aid"),
                           {"id": project_id, "aid": p.agency_id}).first()
    if project is None:
        raise HTTPException(404, "Project not found")
    for member_id in body.membership_ids:
        member = conn.execute(text("""
            SELECT id FROM memberships WHERE id = :mid AND agency_id = :aid
            AND status = 'active' AND role = 'agency_member'
        """), {"mid": member_id, "aid": p.agency_id}).first()
        if member is None:
            raise HTTPException(404, "Agency member not found")
        conn.execute(text("""
            INSERT INTO project_members (project_id, membership_id, agency_id)
            VALUES (:pid, :mid, :aid) ON CONFLICT DO NOTHING
        """), {"pid": project_id, "mid": member_id, "aid": p.agency_id})
    log(conn, p, "project.members_added", {"project_id": str(project_id),
        "membership_ids": [str(x) for x in body.membership_ids]})
    return {"added": len(body.membership_ids)}


@router.get("/projects/{project_id}/members")
def list_project_members(project_id: UUID, p: Principal = Depends(agency_only),
                         conn: Connection = Depends(get_conn)):
    visible_project(conn, p, project_id)
    rows = conn.execute(text("""
        SELECT m.id AS membership_id, m.user_id, u.email, u.full_name, m.role
        FROM project_members pm
        JOIN memberships m ON m.id = pm.membership_id AND m.agency_id = pm.agency_id
        JOIN users u ON u.id = m.user_id
        WHERE pm.project_id = :pid AND pm.agency_id = :aid AND m.status = 'active'
        ORDER BY u.full_name
    """), {"pid": project_id, "aid": p.agency_id}).mappings().all()
    return [dict(row) for row in rows]
