from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import log, visible_project, visible_task
from ..deps import Principal, agency_only, get_conn

router = APIRouter(tags=["time"])


class TimeCreate(BaseModel):
    minutes: int = Field(gt=0)
    entry_date: date | None = None
    note: str | None = None


@router.post("/tasks/{task_id}/time", status_code=201)
def add_time(task_id: UUID, body: TimeCreate, p: Principal = Depends(agency_only),
             conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    row = conn.execute(text("""
        INSERT INTO time_entries (agency_id, task_id, membership_id, minutes, entry_date, note)
        VALUES (:aid, :tid, :mid, :minutes, COALESCE(:entry_date, current_date), :note) RETURNING *
    """), {**body.model_dump(), "aid": p.agency_id, "tid": task_id, "mid": p.membership_id}).mappings().one()
    log(conn, p, "time.logged", {"entry_id": str(row["id"])})
    return dict(row)


@router.get("/tasks/{task_id}/time")
def list_task_time(task_id: UUID, p: Principal = Depends(agency_only),
                   conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    rows = conn.execute(text("""
        SELECT te.*, t.project_id
        FROM time_entries te JOIN tasks t
          ON t.id = te.task_id AND t.agency_id = te.agency_id
        WHERE te.task_id = :tid AND te.agency_id = :aid
        ORDER BY te.entry_date DESC, te.id
    """), {"tid": task_id, "aid": p.agency_id}).mappings().all()
    return [dict(row) for row in rows]


@router.get("/projects/{project_id}/hours")
def project_hours(project_id: UUID, p: Principal = Depends(agency_only),
                  conn: Connection = Depends(get_conn)):
    visible_project(conn, p, project_id)
    rows = conn.execute(text("""
        SELECT m.id AS membership_id, u.full_name,
               COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN te.minutes ELSE 0 END), 0) / 60.0 AS hours
        FROM memberships m JOIN users u ON u.id = m.user_id
        LEFT JOIN time_entries te ON te.membership_id = m.id AND te.agency_id = m.agency_id
        LEFT JOIN tasks t ON t.id = te.task_id AND t.agency_id = te.agency_id AND t.project_id = :pid
        WHERE m.agency_id = :aid AND m.role <> 'client_user' AND m.status = 'active'
        GROUP BY m.id, u.full_name ORDER BY u.full_name
    """), {"pid": project_id, "aid": p.agency_id}).mappings().all()
    members = [dict(r) for r in rows]
    return {"members": members, "total_hours": sum(r["hours"] for r in members)}
