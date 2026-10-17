from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import log, params, task_scope, visible_project, visible_task
from ..deps import Principal, agency_only, get_conn, get_principal

router = APIRouter(tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: Literal["todo", "in_progress", "in_review", "done"] = "todo"
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    visibility: Literal["internal", "client_visible"] = "internal"
    assignee_id: UUID | None = None
    due_date: date | None = None


class TaskPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["todo", "in_progress", "in_review", "done"] | None = None
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    visibility: Literal["internal", "client_visible"] | None = None
    assignee_id: UUID | None = None
    due_date: date | None = None


@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: UUID, status: Literal["todo", "in_progress", "in_review", "done"] | None = None,
               priority: Literal["low", "medium", "high", "urgent"] | None = None,
               assignee: UUID | None = None, q: str | None = None,
               p: Principal = Depends(get_principal), conn: Connection = Depends(get_conn)):
    visible_project(conn, p, project_id)
    clauses = [f"t.project_id = :pid", task_scope(p)]
    values = {**params(p), "pid": project_id}
    for key, value in (("status", status), ("priority", priority), ("assignee_id", assignee)):
        if value is not None:
            clauses.append(f"t.{key} = :{key}")
            values[key] = value
    if q:
        clauses.append("(t.title ILIKE '%' || :q || '%' OR COALESCE(t.description, '') ILIKE '%' || :q || '%')")
        values["q"] = q
    rows = conn.execute(text(f"SELECT t.* FROM tasks t WHERE {' AND '.join(clauses)} ORDER BY t.created_at DESC"),
                        values).mappings().all()
    return [dict(row) for row in rows]


@router.get("/tasks/{task_id}")
def get_task(task_id: UUID, p: Principal = Depends(get_principal),
             conn: Connection = Depends(get_conn)):
    return dict(visible_task(conn, p, task_id))


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: UUID, body: TaskCreate, p: Principal = Depends(agency_only),
                conn: Connection = Depends(get_conn)):
    project = visible_project(conn, p, project_id)
    if body.assignee_id:
        assigned = conn.execute(text("""
            SELECT 1 FROM project_members pm JOIN memberships m
              ON m.id = pm.membership_id AND m.agency_id = pm.agency_id
            WHERE pm.project_id = :pid AND pm.membership_id = :mid
              AND pm.agency_id = :aid AND m.status = 'active'
        """), {"pid": project_id, "mid": body.assignee_id, "aid": p.agency_id}).first()
        if assigned is None:
            raise HTTPException(400, "Assignee must be an active project member")
    row = conn.execute(text("""
        INSERT INTO tasks (agency_id, project_id, title, description, status, priority,
                           visibility, assignee_id, due_date, created_by)
        VALUES (:aid, :pid, :title, :description, :status, :priority, :visibility,
                :assignee_id, :due_date, :mid) RETURNING *
    """), {**body.model_dump(), "aid": p.agency_id, "pid": project["id"], "mid": p.membership_id}).mappings().one()
    log(conn, p, "task.created", {"task_id": str(row["id"])})
    return dict(row)


@router.patch("/tasks/{task_id}")
def update_task(task_id: UUID, body: TaskPatch, p: Principal = Depends(agency_only),
                conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    values = body.model_dump(exclude_unset=True)
    if not values:
        return dict(visible_task(conn, p, task_id))
    if any(values.get(field) is None for field in ("title", "status", "priority", "visibility")
           if field in values):
        raise HTTPException(422, "Task title, status, priority, and visibility cannot be null")
    if "assignee_id" in values and values["assignee_id"] is not None:
        row = conn.execute(text("""
            SELECT 1 FROM project_members pm JOIN tasks t ON t.project_id = pm.project_id
            JOIN memberships m ON m.id = pm.membership_id AND m.agency_id = pm.agency_id
            WHERE t.id = :tid AND pm.membership_id = :mid AND pm.agency_id = :aid AND m.status = 'active'
        """), {"tid": task_id, "mid": values["assignee_id"], "aid": p.agency_id}).first()
        if row is None:
            raise HTTPException(400, "Assignee must be an active project member")
    values.update({"id": task_id, "aid": p.agency_id})
    sets = ", ".join(f"{key} = :{key}" for key in body.model_fields if key in values)
    result = conn.execute(text(f"""
        UPDATE tasks SET {sets}, updated_at = now()
        WHERE id = :id AND agency_id = :aid RETURNING *
    """), values).mappings().first()
    if result is None:
        raise HTTPException(404, "Task not found")
    log(conn, p, "task.updated", {"task_id": str(task_id), "fields": list(body.model_dump(exclude_unset=True))})
    return dict(result)
