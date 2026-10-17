from fastapi.testclient import TestClient

from app.main import app
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
