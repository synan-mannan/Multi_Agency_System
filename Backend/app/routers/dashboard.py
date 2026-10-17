from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import file_scope, params, project_scope, task_scope, visible_project
from ..deps import Principal, get_conn, get_principal

router = APIRouter(tags=["dashboard"])


@router.get("/projects/{project_id}/dashboard")
def project_dashboard(project_id: UUID, p: Principal = Depends(get_principal),
                      conn: Connection = Depends(get_conn)):
    visible_project(conn, p, project_id)
    row = conn.execute(text(f"""
        SELECT t.status, count(*) AS count
        FROM tasks t WHERE t.project_id = :pid AND {task_scope(p)}
        GROUP BY t.status
    """), {**params(p), "pid": project_id}).mappings().all()
    counts = {status: 0 for status in ("todo", "in_progress", "in_review", "done")}
    for r in row:
        counts[r["status"]] = r["count"]
    minutes = conn.execute(text(f"""
        SELECT COALESCE(sum(te.minutes), 0)
        FROM time_entries te JOIN tasks t
          ON t.id = te.task_id AND t.agency_id = te.agency_id
        WHERE t.project_id = :pid AND {task_scope(p)}
    """), {**params(p), "pid": project_id}).scalar_one()
    return {"task_counts": counts, "total_hours": minutes / 60}


@router.get("/dashboard")
def agency_dashboard(p: Principal = Depends(get_principal), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text(f"""
        SELECT t.status, count(*) AS count
        FROM tasks t WHERE {task_scope(p)}
        GROUP BY t.status
    """), params(p)).mappings().all()
    counts = {status: 0 for status in ("todo", "in_progress", "in_review", "done")}
    for row in rows:
        counts[row["status"]] = row["count"]
    projects = conn.execute(text(f"""
        SELECT p.id AS project_id, p.name, count(t.id) AS task_count,
               count(t.id) FILTER (WHERE t.status = 'done') AS done_count
        FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.agency_id = p.agency_id
          AND {task_scope(p, 't')}
        WHERE {project_scope(p)}
        GROUP BY p.id, p.name ORDER BY p.created_at DESC
    """), params(p)).mappings().all()
    files = conn.execute(text(f"""
        SELECT count(*) FROM files f
        WHERE f.review_status = 'pending' AND {file_scope(p)}
    """), params(p)).scalar_one()
    minutes = conn.execute(text(f"""
        SELECT COALESCE(sum(te.minutes), 0)
        FROM time_entries te JOIN tasks t ON t.id = te.task_id AND t.agency_id = te.agency_id
        WHERE te.entry_date >= date_trunc('week', current_date)::date
          AND te.entry_date <= current_date AND {task_scope(p)}
    """), params(p)).scalar_one()
    due_this_week = conn.execute(text(f"""
        SELECT count(*) FROM tasks t
        WHERE t.due_date >= current_date AND t.due_date <= current_date + 7
          AND t.status <> 'done' AND {task_scope(p)}
    """), params(p)).scalar_one()
    return {
        "task_counts": counts,
        "hours_this_week": minutes / 60,
        "due_this_week": due_this_week,
        "projects": [dict(row) for row in projects],
        "files_awaiting_review": files,
    }
