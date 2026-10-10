#!/usr/bin/env bash
# FE↔BE contract: the backend is the source of truth. Exports the FastAPI
# OpenAPI schema and regenerates src/api/openapi_schema.pure.lib.ts from it.
#   scripts/gen_api.sh          regenerate
#   scripts/gen_api.sh --check  regenerate, then fail if anything changed (CI)
set -euo pipefail
frontend="$(cd "$(dirname "$0")/.." && pwd)"
backend="$frontend/../backend"
python="${BACKEND_PYTHON:-$backend/.venv/bin/python}"

# Run from backend/: the legacy app writes logs/ relative to the working directory.
(cd "$backend" && "$python" scripts/export_openapi.py "$frontend/src/api/openapi.json")
(cd "$frontend" && npx openapi-typescript src/api/openapi.json --output src/api/openapi_schema.pure.lib.ts --immutable --alphabetize >/dev/null)

if [[ "${1:-}" == "--check" ]]; then
  if ! git -C "$frontend" diff --exit-code --stat -- src/api/openapi.json src/api/openapi_schema.pure.lib.ts; then
    echo "API contract drifted: run 'make gen-api' and commit the result." >&2
    exit 1
  fi
fi
