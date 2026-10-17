# AgencyDesk API

A minimal multi-tenant client/project API built with FastAPI, PostgreSQL 16, SQLAlchemy Core, and row-level security (RLS).

## Run locally

> **Important:** Docker is required to run the backend. Please install Docker before continuing.

From the repository root:

### Linux

```sh
cd Backend
docker compose up -d
python3 -m venv .venv          # Python 3.12 required
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
```

### Windows

```sh
cd Backend
docker compose up -d
python -m venv venv            # Python 3.11 or 3.12 required
./venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
```

To run the tests, open another terminal and run:

```sh
cd Backend && . .venv/bin/activate && pytest
```

(On Windows, activate with `./venv/Scripts/activate` instead.)

The demo password printed by `seed.py` is shared by all demo accounts. To override the local defaults, set `JWT_SECRET`, `DATABASE_URL`, `SYSTEM_DATABASE_URL`, and `STORAGE_DIR`.

`DATABASE_URL` must connect as `app_user` (default password `app_pw`). `SYSTEM_DATABASE_URL` is the schema-owner connection used by migrations, login/workspace selection, and invite acceptance. Files are stored under `./storage`.

## Login details

| Role          | Email                                                  |
| ------------- | ------------------------------------------------------ |
| Alpha admin   | admin.alpha@agencydesk.test                            |
| Alpha members | member.one@agencydesk.test, member.two@agencydesk.test |
| Alpha clients | shared@agencydesk.test, client.two@agencydesk.test     |
| Beta admin    | shared@agencydesk.test (same global identity)          |

Demo password: `AgencyDesk123!`

Note: `shared@agencydesk.test` is a client in Alpha and an admin in Beta.

## Frontend

1. From the repository root, Open a new terminal window and run `cd frontend`.
2. run `npm install`.
3. Run `npm run dev`.
4. Once it is running, copy the link from the terminal and paste it into your browser.

Setup is now complete, and you can use and test the interactive frontend.

## Manual isolation and visibility testing

If you prefer not to use the frontend, you can test manually. The commands below are for Linux.

```sh
# Log in as shared@agencydesk.test with portal=true, then select the Alpha client workspace.
curl -H "Authorization: Bearer $ALPHA_CLIENT_TOKEN" http://localhost:8000/projects

# List visible tasks: internal task rows must be absent.
curl -H "Authorization: Bearer $ALPHA_CLIENT_TOKEN" "http://localhost:8000/projects/$ALPHA_PROJECT_ID/tasks?q=internal"

# Request a known internal task or internal file: the response must be 404.
curl -i -H "Authorization: Bearer $ALPHA_CLIENT_TOKEN" http://localhost:8000/tasks/$INTERNAL_TASK_ID

# Log in as the Alpha admin; requesting a known Beta project must still be 404.
curl -i -H "Authorization: Bearer $ALPHA_ADMIN_TOKEN" http://localhost:8000/projects/$BETA_PROJECT_ID

# The client's dashboard includes only visible tasks and their time; client task writes are forbidden.
curl -H "Authorization: Bearer $ALPHA_CLIENT_TOKEN" http://localhost:8000/projects/$ALPHA_PROJECT_ID/dashboard
```
