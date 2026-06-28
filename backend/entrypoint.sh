#!/bin/sh
set -e

log() { printf '[%s] [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2"; }

log INFO "Running database migrations..."
alembic upgrade head
log INFO "Migrations complete. Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
