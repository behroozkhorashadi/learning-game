#!/bin/sh
# Starts the FastAPI backend for the e2e suite against a brand-new temp
# database and picture folder, so a run never reads or writes real data.
# Launched by playwright.config.ts (which also sets ADMIN_PASSWORD, blanks
# OPENAI_API_KEY, etc.).
#
# The folder is wiped at the *start* of each run rather than on exit —
# Playwright kills this process outright, so an exit trap wouldn't run — which
# also leaves the last run's DB around to inspect after a failure.
set -eu

E2E_DIR="${TMPDIR:-/tmp}/learning-game-e2e"
rm -rf "$E2E_DIR"
mkdir -p "$E2E_DIR"

export DATABASE_URL="sqlite:///$E2E_DIR/e2e.db"
export STATIC_DIR="$E2E_DIR/static"
echo "e2e backend: temp data in $E2E_DIR"

cd "$(dirname "$0")/../../backend"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${E2E_BACKEND_PORT:-8100}" --no-access-log
