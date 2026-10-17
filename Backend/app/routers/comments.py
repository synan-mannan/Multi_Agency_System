from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import comment_scope, log, params, visible_task
from ..deps import Principal, get_conn, get_principal

router = APIRouter(tags=["comments"])


class CommentCreate(BaseModel):
    body: str
    visibility: Literal["internal", "client_visible"] = "internal"


@router.get("/tasks/{task_id}/comments")
def list_comments(task_id: UUID, p: Principal = Depends(get_principal),
                  conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    rows = conn.execute(text(f"""
        SELECT c.* FROM comments c WHERE c.task_id = :tid AND {comment_scope(p)}
        ORDER BY c.created_at
    """), {**params(p), "tid": task_id}).mappings().all()
    return [dict(row) for row in rows]


@router.post("/tasks/{task_id}/comments", status_code=201)
def create_comment(task_id: UUID, body: CommentCreate, p: Principal = Depends(get_principal),
                   conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    visibility = "client_visible" if p.role == "client_user" else body.visibility
    row = conn.execute(text("""
        INSERT INTO comments (agency_id, task_id, author_id, body, visibility)
        VALUES (:aid, :tid, :mid, :body, :visibility) RETURNING *
    """), {"aid": p.agency_id, "tid": task_id, "mid": p.membership_id,
           "body": body.body, "visibility": visibility}).mappings().one()
    log(conn, p, "comment.created", {"comment_id": str(row["id"])})
    return dict(row)
