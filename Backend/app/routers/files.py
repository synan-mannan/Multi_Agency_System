from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..access import file_scope, log, params, visible_task
from ..config import settings
from ..deps import Principal, agency_only, get_conn, get_principal
from ..storage import file_path, save

router = APIRouter(tags=["files"])


class Review(BaseModel):
    status: Literal["approved", "changes_requested"]
    note: str | None = None


@router.post("/tasks/{task_id}/files", status_code=201)
def upload_file(task_id: UUID, file: UploadFile = File(...),
                visibility: Literal["internal", "client_visible"] = Form("internal"),
                p: Principal = Depends(agency_only), conn: Connection = Depends(get_conn)):
    visible_task(conn, p, task_id)
    content = file.file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(413, "File exceeds the 10MB limit")
    key = save(content)
    row = conn.execute(text("""
        INSERT INTO files (agency_id, task_id, uploaded_by, storage_key, original_name,
                           mime_type, size_bytes, visibility)
        VALUES (:aid, :tid, :mid, :key, :name, :mime, :size, :visibility) RETURNING *
    """), {"aid": p.agency_id, "tid": task_id, "mid": p.membership_id, "key": key,
           "name": Path(file.filename or "upload").name, "mime": file.content_type or "application/octet-stream",
           "size": len(content), "visibility": visibility}).mappings().one()
    log(conn, p, "file.uploaded", {"file_id": str(row["id"])})
    return {k: v for k, v in dict(row).items() if k != "storage_key"}


@router.get("/tasks/{task_id}/files")
def list_files(task_id: UUID, p: Principal = Depends(get_principal),
               conn: Connection = Depends(get_conn)):
    visible_task(conn, p, str(task_id))
    rows = conn.execute(text(f"""
        SELECT f.id, f.agency_id, f.task_id, f.uploaded_by, f.original_name, f.mime_type,
               f.size_bytes, f.visibility, f.review_status, f.reviewed_at, f.review_note, f.created_at
        FROM files f WHERE f.task_id = :tid AND {file_scope(p)} ORDER BY f.created_at
    """), {**params(p), "tid": task_id}).mappings().all()
    return [dict(row) for row in rows]


@router.get("/files/{file_id}/download")
def download_file(file_id: UUID, p: Principal = Depends(get_principal),
                  conn: Connection = Depends(get_conn)):
    row = conn.execute(text(f"SELECT f.* FROM files f WHERE f.id = :id AND {file_scope(p)}"),
                       {**params(p), "id": file_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "File not found")
    path = file_path(row["storage_key"])
    return FileResponse(path, media_type=row["mime_type"], filename=row["original_name"])


@router.post("/files/{file_id}/review")
def review_file(file_id: UUID, body: Review, p: Principal = Depends(get_principal),
                conn: Connection = Depends(get_conn)):
    if p.role != "client_user":
        raise HTTPException(403, "Client access required")
    row = conn.execute(text(f"SELECT f.id FROM files f WHERE f.id = :id AND {file_scope(p)}"),
                       {**params(p), "id": file_id}).first()
    if row is None:
        raise HTTPException(404, "File not found")
    result = conn.execute(text("""
        UPDATE files SET review_status = :status, reviewed_by = :mid,
                         reviewed_at = now(), review_note = :note
        WHERE id = :id AND agency_id = :aid RETURNING id, review_status, reviewed_at, review_note
    """), {"status": body.status, "mid": p.membership_id, "note": body.note,
           "id": file_id, "aid": p.agency_id}).mappings().one()
    log(conn, p, "file.reviewed", {"file_id": str(file_id), "status": body.status})
    return dict(result)
