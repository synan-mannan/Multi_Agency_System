
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE app_user LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE agencydesk TO app_user;
GRANT USAGE, CREATE ON SCHEMA public TO app_user;
SQL
