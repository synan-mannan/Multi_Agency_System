from uuid import uuid4

from sqlalchemy import text
from fastapi.testclient import TestClient

from app.db import system_engine, tenant_session
from app.main import app
from tests.conftest import login


def test_one_identity_can_select_different_roles(demo):
    with TestClient(app) as client:
        client_token, client_workspace = login(client, "shared@agencydesk.test", True)
        admin_token, admin_workspace = login(client, "shared@agencydesk.test", False)
    assert client_token != admin_token
    assert client_workspace["role"] == "client_user"
    assert admin_workspace["role"] == "agency_admin"


def test_invite_resend_and_accept_are_idempotent(demo):
    email = f"invitee-{uuid4().hex}@agencydesk.test"
    with TestClient(app) as client:
        admin_token, _ = login(client, "admin.alpha@agencydesk.test", False)
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {"email": email, "role": "agency_member"}
        first = client.post("/invites", headers=headers, json=payload).json()
        second = client.post("/invites", headers=headers, json=payload).json()
        assert first["invite_id"] == second["invite_id"]
        assert first["token"] != second["token"]
        accepted = client.post("/invites/accept", json={
            "token": second["token"], "full_name": "New Member", "password": "InvitePass123!",
        })
        assert accepted.status_code == 200
        again = client.post("/invites/accept", json={
            "token": second["token"], "full_name": "New Member", "password": "InvitePass123!",
        })
        assert again.status_code == 409
    with system_engine.begin() as conn:
        assert conn.execute(text("""
            SELECT count(*) FROM invites WHERE email = :email
        """), {"email": email}).scalar_one() == 1
        assert conn.execute(text("""
            SELECT count(*) FROM invites WHERE email = :email AND status = 'pending'
        """), {"email": email}).scalar_one() == 0
        assert conn.execute(text("SELECT count(*) FROM users WHERE email = :email"),
                            {"email": email}).scalar_one() == 1
        assert conn.execute(text("""
            SELECT count(*) FROM memberships WHERE user_id =
              (SELECT id FROM users WHERE email = :email) AND agency_id = :aid
        """), {"email": email, "aid": demo["alpha"]}).scalar_one() == 1


def test_removed_member_is_locked_out_and_tasks_are_unassigned(demo):
    with TestClient(app) as client:
        member_token, _ = login(client, "member.one@agencydesk.test", False)
        admin_token, _ = login(client, "admin.alpha@agencydesk.test", False)
        removed = client.delete(f"/team/{demo['member_one']}",
                                headers={"Authorization": f"Bearer {admin_token}"})
        assert removed.status_code == 200
        locked = client.get("/projects", headers={"Authorization": f"Bearer {member_token}"})
        assert locked.status_code == 401
    with tenant_session(demo["alpha"]) as conn:
        task = conn.execute(text("""
            SELECT assignee_id FROM tasks WHERE id = :tid
        """), {"tid": demo["task_public"]}).first()
    assert task is not None and task[0] is None
