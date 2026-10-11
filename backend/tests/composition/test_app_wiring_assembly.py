"""Boots the real assembled graph (real SQLite file, real clock and ids) end to end."""

from pathlib import Path

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.composition.app_settings_assembly import AppSettings
from app.composition.app_wiring_assembly import TODO_ROUTE_PREFIX, assemble_app
from app.main import app as legacy_app  # the legacy entry; tests/conftest.py points it at a temp DB


def _settings(tmp_path: Path, *, todo_example_enabled: bool) -> AppSettings:
    return AppSettings(
        admin_password=SecretStr("composition-test"),
        database_url=f"sqlite:///{tmp_path / 'app.db'}",
        static_dir=tmp_path / "static",
        log_dir=tmp_path / "logs",
        todo_example_enabled=todo_example_enabled,
    )


def _client(settings: AppSettings) -> httpx.Client:
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(assemble_app(settings))


def test_todos_persist_across_app_instances(tmp_path: Path) -> None:
    settings = _settings(tmp_path, todo_example_enabled=True)
    with _client(settings) as first:
        created = first.post(TODO_ROUTE_PREFIX, json={"title": "survive a restart"}).json()
    with _client(settings) as second:
        assert second.get(TODO_ROUTE_PREFIX).json() == [created]


def test_flag_off_does_not_mount_the_feature(tmp_path: Path) -> None:
    settings = _settings(tmp_path, todo_example_enabled=False)
    with _client(settings) as client:
        assert client.get(TODO_ROUTE_PREFIX).status_code == 404


def test_legacy_app_mounts_the_todo_routes() -> None:
    paths = legacy_app.openapi()["paths"]
    assert set(paths[TODO_ROUTE_PREFIX]) == {"get", "post", "put"}
    assert set(paths[f"{TODO_ROUTE_PREFIX}/{{todo_id}}"]) == {"patch"}


def test_profiles_and_admin_are_served_by_the_assembled_graph(tmp_path: Path) -> None:
    with _client(_settings(tmp_path, todo_example_enabled=False)) as client:
        created = client.post("/api/profiles", json={"name": "Ada", "avatar": "owl", "birth_year": 2018})
        assert created.status_code == 201
        assert [p["name"] for p in client.get("/api/profiles").json()] == ["Ada"]
        assert client.post("/api/admin/login", json={"password": "composition-test"}).status_code == 204
        headers = {"X-Admin-Password": "composition-test"}
        assert client.delete(f"/api/profiles/{created.json()['id']}", headers=headers).status_code == 204
