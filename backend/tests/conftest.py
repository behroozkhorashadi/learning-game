"""Shared test fixtures. Points the app at a throwaway SQLite file for the whole
test session (set before any `app.*` module is imported) so tests exercise the
real db.py/main.py wiring instead of a mocked one."""

import os
import tempfile

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
