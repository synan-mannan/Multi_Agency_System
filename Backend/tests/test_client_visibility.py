from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import tenant_session
from app.main import app
from app.storage import file_path
from tests.conftest import login


def test_client_cannot_observe_internal_content(demo):
    with TestClient(app) as client:
        token, workspace = login(client, "shared@agencydesk.test", True)
        headers = {"Authorization": f"Bearer {token}"}
        assert str(workspace["client_id"]) == str(demo["alpha_client_a"])
        projects = client.get("/projects", headers=headers).json()
        project_id = str(demo["project_a"])
        assert [str(project["id"]) for project in projects] == [project_id]
        tasks = client.get(f"/projects/{project_id}/tasks", headers=headers).json()
        assert [task["title"] for task in tasks] == ["Client-visible task"]
        assert client.get(f"/tasks/{demo['task_internal']}", headers=headers).status_code == 404
        assert client.get(f"/projects/{project_id}/tasks?q=planning", headers=headers).json() == []
        comments = client.get(f"/tasks/{demo['task_public']}/comments", headers=headers).json()
        assert [comment["body"] for comment in comments] == ["Visible comment"]
        files = client.get(f"/tasks/{demo['task_public']}/files", headers=headers).json()
        assert [item["original_name"] for item in files] == ["client-visible.txt"]
        assert client.get(f"/files/{demo['internal_file_id']}/download",
                          headers=headers).status_code == 404
        assert client.get(f"/files/{demo['public_file_id']}/download",
                          headers=headers).status_code == 200
        dashboard = client.get(f"/projects/{project_id}/dashboard", headers=headers).json()
        assert sum(dashboard["task_counts"].values()) == 1
        assert dashboard["total_hours"] == 0.75
        assert client.get(f"/projects/{project_id}/hours", headers=headers).status_code == 403
        assert client.post(f"/projects/{project_id}/tasks", headers=headers,
                           json={"title": "No client task"}).status_code == 403
        assert client.patch(f"/tasks/{demo['task_public']}", headers=headers,
                            json={"status": "done"}).status_code == 403


def test_client_can_see_client_visible_files_on_internal_tasks(demo):
    with TestClient(app) as client:
        admin_token, _ = login(client, "admin.alpha@agencydesk.test", False)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        shared_name = f"shared-{uuid4().hex}.txt"
        uploaded = client.post(
            f"/tasks/{demo['task_internal']}/files",
            headers=admin_headers,
            files={"file": (shared_name, b"Shared with client", "text/plain")},
            data={"visibility": "client_visible"},
        )
        assert uploaded.status_code == 201, uploaded.text

        client_token, workspace = login(client, "shared@agencydesk.test", True)
        client_headers = {"Authorization": f"Bearer {client_token}"}
        project_files = client.get(
            f"/projects/{demo['project_a']}/files", headers=client_headers,
        )
        assert project_files.status_code == 200, project_files.text
        assert shared_name in [item["original_name"] for item in project_files.json()]
        assert all(item["visibility"] == "client_visible" for item in project_files.json())
        assert client.get(
            f"/files/{uploaded.json()['id']}/download", headers=client_headers,
        ).status_code == 200
        assert client.get(
            f"/files/{demo['internal_file_id']}/download", headers=client_headers,
        ).status_code == 404


def test_agency_can_update_file_visibility_and_delete_file(demo):
    with TestClient(app) as client:
        admin_token, _ = login(client, "admin.alpha@agencydesk.test", False)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        uploaded = client.post(
            f"/tasks/{demo['task_public']}/files",
            headers=admin_headers,
            files={"file": (f"managed-{uuid4().hex}.txt", b"Managed file", "text/plain")},
            data={"visibility": "internal"},
        )
        assert uploaded.status_code == 201, uploaded.text
        file_id = uploaded.json()["id"]

        client_token, _ = login(client, "shared@agencydesk.test", True)
        client_headers = {"Authorization": f"Bearer {client_token}"}
        assert client.get(f"/files/{file_id}/download", headers=client_headers).status_code == 404
        assert client.patch(
            f"/files/{file_id}", headers=client_headers,
            json={"visibility": "client_visible"},
        ).status_code == 403
        assert client.delete(f"/files/{file_id}", headers=client_headers).status_code == 403

        visible = client.patch(
            f"/files/{file_id}", headers=admin_headers,
            json={"visibility": "client_visible"},
        )
        assert visible.status_code == 200, visible.text
        assert visible.json()["visibility"] == "client_visible"
        assert client.get(f"/files/{file_id}/download", headers=client_headers).status_code == 200

        with tenant_session(demo["alpha"]) as conn:
            storage_key = conn.exec_driver_sql(
                "SELECT storage_key FROM files WHERE id = %s", (file_id,),
            ).scalar_one()
        deleted = client.delete(f"/files/{file_id}", headers=admin_headers)
        assert deleted.status_code == 200, deleted.text
        assert deleted.json() == {"deleted": True}
        assert not file_path(storage_key).exists()
        assert client.get(f"/files/{file_id}/download", headers=admin_headers).status_code == 404
