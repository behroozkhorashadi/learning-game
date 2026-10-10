#!/usr/bin/env bash
# Backend preflight: every backend check CI runs, in CI's order. Fails on the first error.
#   backend/scripts/preflight.sh            (from anywhere; uses backend/.venv)
#   PREFLIGHT_BIN=/path/to/venv/bin ...      (CI: point at another environment)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PREFLIGHT_BIN:-.venv/bin}"

step() { printf '\n==> %s\n' "$*"; }

step "ruff check";          "$BIN/ruff" check
step "ruff format --check"; "$BIN/ruff" format --check
step "pyright (strict)";    "$BIN/pyright"
step "lint-imports";        "$BIN/lint-imports"
step "lint_py (AST rules)"; "$BIN/python" -m scripts.lint_py.run
step "check_cycles";        "$BIN/python" scripts/check_cycles.py
step "pytest";              "$BIN/pytest" -q

printf '\nbackend preflight: all checks passed\n'
