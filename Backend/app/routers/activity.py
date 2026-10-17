
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import (
    comment_scope,
    file_scope,
    params,
    project_scope,
    task_scope,
)
from ..deps import Principal, get_conn, get_principal

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
def list_activity(
    p: Principal = Depends(get_principal),
    conn: Connection = Depends(get_conn),
):
    query = """
        SELECT
            a.id,
            a.actor_id,
            a.action,
            a.details,
            a.created_at,
            u.full_name AS actor_name
        FROM activity_log a
        LEFT JOIN memberships m
            ON m.id = a.actor_id
            AND m.agency_id = a.agency_id
        LEFT JOIN users u ON u.id = m.user_id
        WHERE a.agency_id = :aid
          AND (
            (
              a.action IN ('task.created', 'task.updated')
              AND EXISTS (
                SELECT 1
                FROM tasks t
                WHERE t.id = (a.details->>'task_id')::uuid
                  AND t.agency_id = a.agency_id
                  AND {task_scope}
              )
            )
            OR (
              a.action = 'comment.created'
              AND EXISTS (
                SELECT 1
                FROM comments c
                WHERE c.id = (a.details->>'comment_id')::uuid
                  AND c.agency_id = a.agency_id
                  AND {comment_scope}
              )
            )
            OR (
              a.action = 'time.logged'
              AND :is_agency
              AND EXISTS (
                SELECT 1
                FROM time_entries te
                JOIN tasks t
                  ON t.id = te.task_id
                  AND t.agency_id = te.agency_id
                WHERE te.id = (a.details->>'entry_id')::uuid
                  AND te.agency_id = a.agency_id
                  AND {time_task_scope}
              )
            )
            OR (
              a.action IN ('file.uploaded', 'file.reviewed')
              AND EXISTS (
                SELECT 1
                FROM files f
                WHERE f.id = (a.details->>'file_id')::uuid
                  AND f.agency_id = a.agency_id
                  AND {file_scope}
              )
            )
            OR (
              a.action IN ('project.created', 'project.members_added')
              AND EXISTS (
                SELECT 1
                FROM projects p
                WHERE p.id = (a.details->>'project_id')::uuid
                  AND p.agency_id = a.agency_id
                  AND {project_scope}
              )
            )
            OR :is_admin
          )
        ORDER BY a.created_at DESC
        LIMIT 50
    """.format(
        task_scope=task_scope(p, "t"),
        time_task_scope=task_scope(p, "t"),
        comment_scope=comment_scope(p, "c"),
        file_scope=file_scope(p, "f"),
        project_scope=project_scope(p, "p"),
    )

    rows = conn.execute(
        text(query),
        {
            **params(p),
            "is_admin": p.role == "agency_admin",
            "is_agency": p.role != "client_user",
        },
    ).mappings().all()

    return [dict(row) for row in rows]
