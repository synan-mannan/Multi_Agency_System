
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TYPE member_role AS ENUM ('agency_admin', 'agency_member', 'client_user');
CREATE TYPE visibility AS ENUM ('internal', 'client_visible');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'changes_requested');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text,
  full_name text NOT NULL,
  contact_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  UNIQUE (id, agency_id)
);
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role member_role NOT NULL,
  client_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  removed_at timestamptz,
  UNIQUE (user_id, agency_id),
  UNIQUE (id, agency_id),
  CHECK ((role = 'client_user') = (client_id IS NOT NULL)),
  FOREIGN KEY (client_id, agency_id) REFERENCES clients (id, agency_id)
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agency_id),
  FOREIGN KEY (client_id, agency_id) REFERENCES clients (id, agency_id)
);
CREATE TABLE project_members (
  project_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  PRIMARY KEY (project_id, membership_id),
  FOREIGN KEY (project_id, agency_id) REFERENCES projects (id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, agency_id) REFERENCES memberships (id, agency_id) ON DELETE CASCADE
);
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  visibility visibility NOT NULL DEFAULT 'internal',
  assignee_id uuid,
  due_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agency_id),
  FOREIGN KEY (project_id, agency_id) REFERENCES projects (id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, assignee_id) REFERENCES project_members (project_id, membership_id) ON DELETE SET NULL (assignee_id),
  FOREIGN KEY (created_by, agency_id) REFERENCES memberships (id, agency_id)
);
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  task_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  visibility visibility NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id, agency_id) REFERENCES tasks (id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (author_id, agency_id) REFERENCES memberships (id, agency_id)
);
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  task_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  storage_key text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  visibility visibility NOT NULL DEFAULT 'internal',
  review_status review_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id, agency_id) REFERENCES tasks (id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by, agency_id) REFERENCES memberships (id, agency_id),
  FOREIGN KEY (reviewed_by, agency_id) REFERENCES memberships (id, agency_id)
);
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  task_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  minutes int NOT NULL CHECK (minutes > 0),
  entry_date date NOT NULL DEFAULT current_date,
  note text,
  FOREIGN KEY (task_id, agency_id) REFERENCES tasks (id, agency_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, agency_id) REFERENCES memberships (id, agency_id)
);
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role member_role NOT NULL,
  client_id uuid,
  client_key uuid GENERATED ALWAYS AS (COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  token_hash text NOT NULL,
  status invite_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  CHECK ((role = 'client_user') = (client_id IS NOT NULL)),
  FOREIGN KEY (client_id, agency_id) REFERENCES clients (id, agency_id),
  FOREIGN KEY (invited_by, agency_id) REFERENCES memberships (id, agency_id)
);
CREATE UNIQUE INDEX uq_pending_invite ON invites (agency_id, email, role, client_key) WHERE status = 'pending';
CREATE UNIQUE INDEX uq_invite_token ON invites (token_hash);
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_agency_project_status ON tasks (agency_id, project_id, status);
CREATE INDEX comments_task ON comments (task_id);
CREATE INDEX files_task ON files (task_id);
CREATE INDEX time_entries_task ON time_entries (task_id);

CREATE FUNCTION app_agency() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.agency_id', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients', 'memberships', 'projects', 'project_members', 'tasks', 'comments', 'files', 'time_entries', 'invites', 'activity_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (agency_id = app_agency()) WITH CHECK (agency_id = app_agency())', tbl);
  END LOOP;
END $$;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON agencies USING (id = app_agency()) WITH CHECK (id = app_agency());
