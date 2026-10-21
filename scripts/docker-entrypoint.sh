#!/bin/sh
# Brings the database schema up to date, then starts the server.
# Migrations are forward-only and safe to run on every start: an up-to-date
# database is a no-op. Set SKIP_MIGRATIONS=true to run them some other way.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. See .env.example." >&2
  exit 1
fi

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  node /app/tools/migrate.mjs /app/prisma/migrations
fi

exec node /app/.output/server/index.mjs
