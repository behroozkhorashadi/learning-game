"""Boots the real assembled graph (real SQLite file, real clock and ids) end to end:
startup seeding, and the flows that cross features through assembly."""

import importlib
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.badges.badges_reducers_pure import SEED_BADGES
from app.composition.app_wiring_assembly import TODO_ROUTE_PREFIX, assemble_app, avatar_mascot, local_day
from app.profiles.profiles_schemas_pure import ProfileRecord
from tests.composition.test_app_settings_assembly import EnvOnlySettings as AppSettings

ADMIN = MappingProxyType({"X-Admin-Password": "composition-test"})
KID = MappingProxyType({"name": "Ada", "avatar": "owl", "birth_year": 2018})


def _settings(tmp_path: Path, *, todo_example_enabled: bool = False) -> AppSettings:
    return AppSettings(
        admin_password=SecretStr("composition-test"),
        database_url=f"sqlite:///{tmp_path / 'app.db'}",
        static_dir=tmp_path / "static",
        log_dir=tmp_path / "logs",
        openai_api_key=None,
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


def test_flag_off_does_not_mount_the_todo_example(tmp_path: Path) -> None:
    with _client(_settings(tmp_path)) as client:
        assert client.get(TODO_ROUTE_PREFIX).status_code == 404


def test_the_entry_point_serves_every_route_group(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """`uvicorn app.main:app` builds the whole app from the environment."""
    monkeypatch.setenv("ADMIN_PASSWORD", "entry-test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'entry.db'}")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path / "static"))
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    monkeypatch.delitem(sys.modules, "app.main", raising=False)
    entry_app = getattr(importlib.import_module("app.main"), "app", None)
    assert isinstance(entry_app, FastAPI)
    paths = entry_app.openapi()["paths"]
    for path in (
        TODO_ROUTE_PREFIX,
        "/api/profiles",
        "/api/admin/login",
        "/api/items/next",
        "/api/pieces",
        "/api/profiles/{profile_id}/badges",
        "/api/practice-config",
        "/api/pathfinder/published-maps",
        "/api/profiles/{profile_id}/armory",
        "/api/profiles/{profile_id}/horde/replays",
        "/api/client-errors",
    ):
        assert path in paths


def test_startup_seeds_the_demo_profile_and_the_badges(tmp_path: Path) -> None:
    with _client(_settings(tmp_path)) as client:
        assert [p["name"] for p in client.get("/api/profiles").json()] == ["Demo Kid"]
        assert len(client.get("/api/profiles/1/badges").json()) == len(SEED_BADGES)


def test_attempts_and_pieces_award_badges_and_feed_the_stats(tmp_path: Path) -> None:
    with _client(_settings(tmp_path)) as client:
        kid = client.post("/api/profiles", json=dict(KID)).json()["id"]
        piece = client.post("/api/pieces", json={"profile_id": kid, "game_id": "prompt_forge", "body": "a b c"})
        assert piece.status_code == 201
        for _ in range(5):
            item = client.get("/api/items/next", params={"profile_id": kid, "game_id": "syllable_builder"}).json()
            attempt = {
                "item_id": item["item_id"],
                "profile_id": kid,
                "game_id": "syllable_builder",
                "telemetry": {"correct": True, "hints_used": 0, "time_ms": 1000},
            }
            assert client.post("/api/attempts", json=attempt).status_code == 201
        client.post(
            "/api/ratings", json={"profile_id": kid, "game_id": "syllable_builder", "scale": "faces", "value": 5}
        )

        earned = {b["key"] for b in client.get(f"/api/profiles/{kid}/badges").json() if b["earned"]}
        assert earned == {"word-wizard", "quick-builder"}
        new = {b["key"] for b in client.get(f"/api/profiles/{kid}/badges/new").json()}
        assert new == {"word-wizard", "quick-builder"}
        assert client.post(f"/api/profiles/{kid}/badges/word-wizard/celebrated").status_code == 204
        assert {b["key"] for b in client.get(f"/api/profiles/{kid}/badges/new").json()} == {"quick-builder"}
        stats = client.get(f"/api/profiles/{kid}/stats").json()
        assert (stats["total_stars"], stats["most_played_game"], stats["day_streak"]) == (5, "Syllable Builder", 1)


def test_deleting_a_profile_removes_everything_other_features_keep_for_it(tmp_path: Path) -> None:
    with _client(_settings(tmp_path)) as client:
        kid = client.post("/api/profiles", json=dict(KID)).json()["id"]
        piece = client.post("/api/pieces", json={"profile_id": kid, "game_id": "prompt_forge", "body": "hi"}).json()
        client.post(f"/api/pieces/{piece['id']}/illustrations", json={"prompt_excerpt": "x", "image_url": "u"})
        client.post("/api/ratings", json={"profile_id": kid, "game_id": "prompt_forge", "scale": "faces", "value": 5})
        client.post(f"/api/profiles/{kid}/pathfinder/completions", json={"level_ids": ["easy-a"]})
        game_map = {
            "id": "custom-gone",
            "name": "m",
            "difficulty": "easy",
            "rows": 1,
            "columns": 1,
            "dots": [{"row": 0, "col": 0}],
        }
        client.post(f"/api/profiles/{kid}/pathfinder/maps", json=game_map)
        client.put(
            "/api/practice-config",
            json={"profile_id": kid, "game_id": "fact_fluency", "operations": ["+"], "difficulty": 2},
        )
        client.post(f"/api/profiles/{kid}/armory/rounds", json={"points": 300, "grenades_used": 0})
        replay: dict[str, object] = {"outcome": "left", "duration_ms": 1, "flags": 0, "recording": {"marks": []}}
        assert client.post(f"/api/profiles/{kid}/horde/replays", json=replay).status_code == 201

        assert client.delete(f"/api/profiles/{kid}", headers=dict(ADMIN)).status_code == 204

        assert client.get(f"/api/pieces/{piece['id']}").status_code == 404
        assert client.get("/api/pathfinder/published-maps").json() == []
        other = client.post("/api/profiles", json={**KID, "name": "Bo"}).json()["id"]
        # The map id is free again, so its row really went.
        assert client.post(f"/api/profiles/{other}/pathfinder/maps", json=game_map).status_code == 201
        assert client.get(f"/api/profiles/{other}/stats").json()["total_stars"] == 0
        assert client.get(f"/api/profiles/{other}/armory").json()["earned"] == 0
        assert client.get(f"/api/profiles/{other}/horde/replays").json() == []


def test_badge_art_gets_a_word_avatar_as_its_mascot_but_never_a_photo() -> None:
    def kid(avatar: str) -> ProfileRecord:
        return ProfileRecord(
            id=1,
            name="K",
            avatar=avatar,
            birth_year=2018,
            reading_support=False,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )

    assert avatar_mascot(kid("fox")) == "fox"
    assert avatar_mascot(kid("/static/profile-avatars/abc.jpg")) is None
    assert avatar_mascot(None) is None


def test_local_day_reads_stored_naive_times_as_utc() -> None:
    aware = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
    assert local_day(aware.replace(tzinfo=None)) == local_day(aware)
