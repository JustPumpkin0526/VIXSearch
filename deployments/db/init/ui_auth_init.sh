#!/bin/sh
set -euo pipefail

# Idempotent DB initialization for vss_ui_auth user and privileges
# Usage: run inside a container with psql available and network access to vss-ui-auth-db

POSTGRES_USER=${POSTGRES_USER:-vss}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-vss_pass}
POSTGRES_DB=${POSTGRES_DB:-vss_ui_auth}
VSS_UI_AUTH_DB_USER=${VSS_UI_AUTH_DB_USER:-vss_ui_auth}
VSS_UI_AUTH_DB_PASSWORD=${VSS_UI_AUTH_DB_PASSWORD:-vss_ui_auth}

export PGPASSWORD="$POSTGRES_PASSWORD"
echo "Waiting for vss-ui-auth-db to be ready..."
until pg_isready -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  echo "pg_isready: waiting for vss-ui-auth-db..."
  sleep 1
done
echo "Connecting to vss-ui-auth-db as $POSTGRES_USER to initialize $VSS_UI_AUTH_DB_USER..."

exists=$(psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${VSS_UI_AUTH_DB_USER}'")
if [ "$exists" = "1" ]; then
  echo "Role ${VSS_UI_AUTH_DB_USER} exists — altering password."
  psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER ROLE ${VSS_UI_AUTH_DB_USER} WITH LOGIN PASSWORD '${VSS_UI_AUTH_DB_PASSWORD}';"
else
  echo "Creating role ${VSS_UI_AUTH_DB_USER}."
  psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE ROLE ${VSS_UI_AUTH_DB_USER} WITH LOGIN PASSWORD '${VSS_UI_AUTH_DB_PASSWORD}';"
fi

echo "Applying grants to ${VSS_UI_AUTH_DB_USER}..."
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${VSS_UI_AUTH_DB_USER};"
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT USAGE, CREATE ON SCHEMA public TO ${VSS_UI_AUTH_DB_USER};"
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${VSS_UI_AUTH_DB_USER};"
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${VSS_UI_AUTH_DB_USER};"
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${VSS_UI_AUTH_DB_USER};"
psql -h vss-ui-auth-db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${VSS_UI_AUTH_DB_USER};"

echo "Initialization complete."
