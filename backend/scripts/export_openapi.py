"""Writes the backend's full OpenAPI schema (legacy + new-style routes) as JSON, for
the frontend's generated API types. Tooling: needs no server and no real backend/.env.

    .venv/bin/python scripts/export_openapi.py [OUT.json]    # stdout when no path

Output is deterministic (sorted keys), so CI can regenerate and fail on a diff.
"""

import importlib
import json
import os
import secrets
import sys
import tempfile
from pathlib import Path
from typing import Final

from fastapi import FastAPI

BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]


def export_schema() -> str:
    with tempfile.TemporaryDirectory() as scratch:
        # app.main builds the app from these at import; the schema doesn't depend on them.
        os.environ["ADMIN_PASSWORD"] = secrets.token_hex(16)
        os.environ["DATABASE_URL"] = f"sqlite:///{scratch}/openapi.db"
        os.environ["STATIC_DIR"] = f"{scratch}/static"
        os.environ["TODO_EXAMPLE_ENABLED"] = "true"
        sys.path.insert(0, str(BACKEND_ROOT))
        app = getattr(importlib.import_module("app.main"), "app", None)
        if not isinstance(app, FastAPI):
            msg = "app.main.app is not a FastAPI app"
            raise TypeError(msg)
        return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


def main(argv: list[str]) -> int:
    schema = export_schema()
    if argv:
        Path(argv[0]).write_text(schema)
    else:
        sys.stdout.write(schema)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
