#!/usr/bin/env bash
# Fast staged-files check for the pre-commit hook: ruff (lint + format) and the AST
# rules on just the given backend .py files. Legacy files are skipped (--force-exclude).
#   backend/scripts/precommit.sh backend/app/todo/todo_service_effect.py ...
set -euo pipefail
backend="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PREFLIGHT_BIN:-$backend/.venv/bin}"

files=()
for f in "$@"; do
  abs="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
  case "$abs" in "$backend"/*.py) [ -f "$abs" ] && files+=("$abs") ;; esac
done
[ ${#files[@]} -eq 0 ] && exit 0

cd "$backend"
"$BIN/ruff" check --force-exclude "${files[@]}"
"$BIN/ruff" format --check --force-exclude "${files[@]}"
"$BIN/python" -m scripts.lint_py.run "${files[@]}"
