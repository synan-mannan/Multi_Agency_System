import pytest
from fastapi.testclient import TestClient

from app.main import app
from seed import seed


@pytest.fixture
def demo():
    return seed()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def login(client, email, portal, membership_id=None):
    response = client.post("/auth/login", json={
        "email": email, "password": "AgencyDesk123!", "portal": portal,
    })
    assert response.status_code == 200, response.text
    result = response.json()
    workspace = next((w for w in result["workspaces"]
                      if membership_id is None or str(w["membership_id"]) == str(membership_id)), None)
    assert workspace is not None
    selected = client.post("/auth/select-workspace",
                           headers={"Authorization": f"Bearer {result['identity_token']}"},
                           json={"membership_id": str(workspace["membership_id"])})
    assert selected.status_code == 200, selected.text
    return selected.json()["access_token"], workspace
