import json

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection
from uuid import UUID

from .deps import Principal


def project_scope(p: Principal, alias: str = "p") -> str:
    if p.role == "agency_admin":
        return f"{alias}.agency_id = :aid"
    if p.role == "agency_member":
        return f"""{alias}.agency_id = :aid AND EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = {alias}.id AND pm.membership_id = :mid AND pm.agency_id = :aid
        )"""
    return f"{alias}.agency_id = :aid AND {alias}.client_id = :cid"


def task_scope(p: Principal, alias: str = "t") -> str:
    scope = f"""EXISTS (SELECT 1 FROM projects p WHERE p.id = {alias}.project_id
        AND p.agency_id = {alias}.agency_id AND {project_scope(p, 'p')})"""
    return f"{scope} AND {alias}.visibility = 'client_visible'" if p.role == "client_user" else scope


def comment_scope(p: Principal, alias: str = "c") -> str:
    scope = f"""EXISTS (SELECT 1 FROM tasks t WHERE t.id = {alias}.task_id
        AND t.agency_id = {alias}.agency_id AND {task_scope(p, 't')})"""
    return scope + (f" AND {alias}.visibility = 'client_visible'" if p.role == "client_user" else "")


def file_scope(p: Principal, alias: str = "f") -> str:
    scope = f"""EXISTS (SELECT 1 FROM tasks t JOIN projects p
        ON p.id = t.project_id AND p.agency_id = t.agency_id
        WHERE t.id = {alias}.task_id AND t.agency_id = {alias}.agency_id
        AND {project_scope(p, 'p')})"""
    return scope + (f" AND {alias}.visibility = 'client_visible'" if p.role == "client_user" else "")


def params(p: Principal) -> dict:
    return {"aid": p.agency_id, "mid": p.membership_id, "cid": p.client_id}


def visible_project(conn: Connection, p: Principal, project_id: UUID):
    row = conn.execute(text(f"SELECT p.* FROM projects p WHERE p.id = :id AND {project_scope(p)}"),
                       {**params(p), "id": project_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Project not found")
    return row


def visible_task(conn: Connection, p: Principal, task_id: UUID):
    row = conn.execute(text(f"SELECT t.* FROM tasks t WHERE t.id = :id AND t.agency_id = :aid AND {task_scope(p)}"),
                       {**params(p), "id": task_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Task not found")
    return row


def log(conn: Connection, p: Principal, action: str, details: dict) -> None:
    conn.execute(text("""
        INSERT INTO activity_log (agency_id, actor_id, action, details)
        VALUES (:aid, :mid, :action, CAST(:details AS jsonb))
    """), {**params(p), "action": action, "details": json.dumps(details)})
