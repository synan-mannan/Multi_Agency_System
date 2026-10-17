from sqlalchemy import text

from app.db import system_engine
from app.security import hash_password
from app.storage import save

DEMO_PASSWORD = "AgencyDesk123!"


def seed():
    with system_engine.begin() as conn:
        def one(sql, values):
            return conn.execute(text(sql), values).mappings().one()

        def get_or_create_user(email, name):
            row = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).mappings().first()
            if row:
                return row["id"]
            return one("""
                INSERT INTO users (email, password_hash, full_name)
                VALUES (:email, :password_hash, :name) RETURNING id
            """, {"email": email, "password_hash": hash_password(DEMO_PASSWORD), "name": name})["id"]

        def get_or_create_agency(name):
            row = conn.execute(text("SELECT id FROM agencies WHERE name = :name ORDER BY created_at LIMIT 1"),
                               {"name": name}).mappings().first()
            return row["id"] if row else one("INSERT INTO agencies (name) VALUES (:name) RETURNING id",
                                              {"name": name})["id"]

        def get_or_create_client(agency_id, name):
            row = conn.execute(text("SELECT id FROM clients WHERE agency_id = :aid AND org_name = :name"),
                               {"aid": agency_id, "name": name}).mappings().first()
            return row["id"] if row else one(
                "INSERT INTO clients (agency_id, org_name) VALUES (:aid, :name) RETURNING id",
                {"aid": agency_id, "name": name})["id"]

        def get_or_create_member(agency_id, user_id, role, client_id=None):
            row = conn.execute(text("""
                SELECT id FROM memberships WHERE agency_id = :aid AND user_id = :uid
            """), {"aid": agency_id, "uid": user_id}).mappings().first()
            if row:
                conn.execute(text("""
                    UPDATE memberships SET role = :role, client_id = :cid, status = 'active', removed_at = NULL
                    WHERE id = :id
                """), {"role": role, "cid": client_id, "id": row["id"]})
                return row["id"]
            return one("""
                INSERT INTO memberships (agency_id, user_id, role, client_id)
                VALUES (:aid, :uid, :role, :cid) RETURNING id
            """, {"aid": agency_id, "uid": user_id, "role": role, "cid": client_id})["id"]

        def get_or_create_project(agency_id, client_id, name):
            row = conn.execute(text("SELECT id FROM projects WHERE agency_id = :aid AND name = :name"),
                               {"aid": agency_id, "name": name}).mappings().first()
            return row["id"] if row else one("""
                INSERT INTO projects (agency_id, client_id, name, description)
                VALUES (:aid, :cid, :name, :description) RETURNING id
            """, {"aid": agency_id, "cid": client_id, "name": name,
                  "description": f"Demo project: {name}"})["id"]

        def get_or_create_task(agency_id, project_id, creator_id, title, visibility):
            row = conn.execute(text("SELECT id FROM tasks WHERE agency_id = :aid AND project_id = :pid AND title = :title"),
                               {"aid": agency_id, "pid": project_id, "title": title}).mappings().first()
            return row["id"] if row else one("""
                INSERT INTO tasks (agency_id, project_id, title, description, visibility, created_by)
                VALUES (:aid, :pid, :title, :description, :visibility, :creator) RETURNING id
            """, {"aid": agency_id, "pid": project_id, "title": title,
                  "description": "Seeded example task", "visibility": visibility, "creator": creator_id})["id"]

        alpha = get_or_create_agency("AgencyDesk Alpha")
        beta = get_or_create_agency("AgencyDesk Beta")
        alpha_client_a = get_or_create_client(alpha, "Northwind")
        alpha_client_b = get_or_create_client(alpha, "Contoso")
        beta_client = get_or_create_client(beta, "Globex")
        alpha_admin_user = get_or_create_user("admin.alpha@agencydesk.test", "Alpha Admin")
        member_one_user = get_or_create_user("member.one@agencydesk.test", "Morgan Member")
        member_two_user = get_or_create_user("member.two@agencydesk.test", "Riley Member")
        shared_user = get_or_create_user("shared@agencydesk.test", "Taylor Shared")
        alpha_client_two_user = get_or_create_user("client.two@agencydesk.test", "Casey Client")
        alpha_admin = get_or_create_member(alpha, alpha_admin_user, "agency_admin")
        member_one = get_or_create_member(alpha, member_one_user, "agency_member")
        member_two = get_or_create_member(alpha, member_two_user, "agency_member")
        client_one = get_or_create_member(alpha, shared_user, "client_user", alpha_client_a)
        client_two = get_or_create_member(alpha, alpha_client_two_user, "client_user", alpha_client_b)
        beta_admin_user = shared_user
        beta_admin = get_or_create_member(beta, beta_admin_user, "agency_admin")
        project_a = get_or_create_project(alpha, alpha_client_a, "Northwind Website")
        project_b = get_or_create_project(alpha, alpha_client_b, "Contoso Campaign")
        beta_project = get_or_create_project(beta, beta_client, "Globex Launch")
        for project_id, membership_id in ((project_a, member_one), (project_a, member_two),
                                          (project_b, member_two)):
            conn.execute(text("""
                INSERT INTO project_members (project_id, membership_id, agency_id)
                VALUES (:pid, :mid, :aid) ON CONFLICT DO NOTHING
            """), {"pid": project_id, "mid": membership_id, "aid": alpha})
        task_public = get_or_create_task(alpha, project_a, alpha_admin, "Client-visible task", "client_visible")
        task_internal = get_or_create_task(alpha, project_a, alpha_admin, "Internal planning task", "internal")
        task_other = get_or_create_task(alpha, project_b, alpha_admin, "Contoso internal task", "internal")
        beta_task = get_or_create_task(beta, beta_project, beta_admin, "Beta confidential task", "internal")
        conn.execute(text("""
            UPDATE tasks SET assignee_id = :mid
            WHERE id = :tid AND assignee_id IS NULL
        """), {"mid": member_one, "tid": task_public})
        conn.execute(text("""
            INSERT INTO comments (agency_id, task_id, author_id, body, visibility)
            SELECT :aid, :tid, :author, :body, :visibility
            WHERE NOT EXISTS (SELECT 1 FROM comments WHERE task_id = :tid AND body = :body)
        """), {"aid": alpha, "tid": task_public, "author": alpha_admin,
               "body": "Visible comment", "visibility": "client_visible"})
        conn.execute(text("""
            INSERT INTO comments (agency_id, task_id, author_id, body, visibility)
            SELECT :aid, :tid, :author, :body, 'internal'
            WHERE NOT EXISTS (SELECT 1 FROM comments WHERE task_id = :tid AND body = :body)
        """), {"aid": alpha, "tid": task_public, "author": alpha_admin,
               "body": "Internal note"})
        conn.execute(text("""
            INSERT INTO time_entries (agency_id, task_id, membership_id, minutes, entry_date, note)
            SELECT :aid, :tid, :mid, 45, current_date, 'Demo time'
            WHERE NOT EXISTS (SELECT 1 FROM time_entries WHERE task_id = :tid AND note = 'Demo time')
        """), {"aid": alpha, "tid": task_public, "mid": member_one})
        conn.execute(text("""
            INSERT INTO time_entries (agency_id, task_id, membership_id, minutes, entry_date, note)
            SELECT :aid, :tid, :mid, 90, current_date, 'Internal demo time'
            WHERE NOT EXISTS (SELECT 1 FROM time_entries WHERE task_id = :tid AND note = 'Internal demo time')
        """), {"aid": alpha, "tid": task_internal, "mid": member_two})
        seeded_files = {}
        for agency_id, task_id, uploader, name, visibility in (
            (alpha, task_public, alpha_admin, "client-visible.txt", "client_visible"),
            (alpha, task_public, alpha_admin, "internal.txt", "internal"),
            (beta, beta_task, beta_admin, "beta.txt", "internal"),
        ):
            existing = conn.execute(text("""
                SELECT id FROM files WHERE task_id = :tid AND original_name = :name
            """), {"tid": task_id, "name": name}).mappings().first()
            if existing:
                file_id = existing["id"]
            else:
                content = f"Demo file: {name}\n".encode()
                file_id = one("""
                    INSERT INTO files (agency_id, task_id, uploaded_by, storage_key, original_name,
                                       mime_type, size_bytes, visibility)
                    VALUES (:aid, :tid, :uploader, :key, :name, 'text/plain', :size, :visibility)
                    RETURNING id
                """, {"aid": agency_id, "tid": task_id, "uploader": uploader, "key": save(content),
                      "name": name, "size": len(content), "visibility": visibility})["id"]
            seeded_files[name] = file_id
        return {
            "alpha": alpha, "beta": beta, "alpha_client_a": alpha_client_a,
            "alpha_client_b": alpha_client_b, "beta_client": beta_client,
            "alpha_admin": alpha_admin, "member_one": member_one, "member_two": member_two,
            "client_one": client_one, "client_two": client_two, "beta_admin": beta_admin,
            "project_a": project_a, "project_b": project_b, "beta_project": beta_project,
            "task_public": task_public, "task_internal": task_internal,
            "task_other": task_other, "beta_task": beta_task,
            "public_file_id": seeded_files["client-visible.txt"],
            "internal_file_id": seeded_files["internal.txt"],
            "beta_file_id": seeded_files["beta.txt"],
        }


if __name__ == "__main__":
    result = seed()
    print("Demo password:", DEMO_PASSWORD)
    print("Alpha admin: admin.alpha@agencydesk.test")
    print("Alpha members: member.one@agencydesk.test, member.two@agencydesk.test")
    print("Alpha clients: shared@agencydesk.test, client.two@agencydesk.test")
    print("Beta admin: shared@agencydesk.test (same global identity)")
