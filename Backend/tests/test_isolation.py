from fastapi.testclient import TestClient

from app.db import tenant_session
from app.main import app
from tests.conftest import login


def test_cross_agency_reads_and_writes_are_hidden(demo):
    with TestClient(app) as client:
        token, _ = login(client, "admin.alpha@agencydesk.test", False)
        headers = {"Authorization": f"Bearer {token}"}
        for path in (
            f"/projects/{demo['beta_project']}",
            f"/tasks/{demo['beta_task']}",
            f"/tasks/{demo['beta_task']}/comments",
            f"/tasks/{demo['beta_task']}/files",
            f"/projects/{demo['beta_project']}/dashboard",
            f"/files/{demo['beta_file_id']}/download",
        ):
            response = client.get(path, headers=headers)
            assert response.status_code == 404, (path, response.text)
        response = client.patch(f"/tasks/{demo['beta_task']}", headers=headers,
                                json={"status": "done"})
        assert response.status_code == 404
        response = client.post("/projects", headers=headers, json={
            "client_id": str(demo["beta_client"]), "name": "Cross-tenant write",
        })
        assert response.status_code == 404


def test_rls_filters_tenant_rows_without_where_clause(demo):
    with tenant_session(demo["alpha"]) as conn:
        rows = conn.exec_driver_sql("SELECT agency_id FROM tasks").all()
    assert rows
    assert {str(row[0]) for row in rows} == {str(demo["alpha"])}
