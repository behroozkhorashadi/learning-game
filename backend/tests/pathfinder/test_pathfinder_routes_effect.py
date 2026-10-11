"""Per-profile Pathfinder state over HTTP: finished curated levels and saved custom
maps, on the real SQL repository with the profile lookups faked (profiles 1 "Maker"
and 2 "Other" exist)."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.pathfinder.pathfinder_repository_effect import make_sql_pathfinder_repository
from app.pathfinder.pathfinder_routes_effect import bind_pathfinder_routes
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
from tests.pathfinder.pathfinder_fakes import DOTS, TickingClock, map_body, profile_exists, profile_names

MAPS = "/api/profiles/1/pathfinder/maps"
OTHER_MAPS = "/api/profiles/2/pathfinder/maps"
PUBLISHED = "/api/pathfinder/published-maps"


@pytest.fixture
def client(tmp_path: Path) -> httpx.Client:
    repository = make_sql_pathfinder_repository(engine=create_engine(f"sqlite:///{tmp_path / 'pathfinder.db'}"))
    repository.create_schema()
    service = make_pathfinder_service(
        repository=repository, profile_exists=profile_exists, profile_names=profile_names, clock=TickingClock()
    )
    app = FastAPI()
    app.include_router(bind_pathfinder_routes(service=service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_completions_start_empty_and_are_recorded_once_per_profile(client: httpx.Client) -> None:
    url = "/api/profiles/1/pathfinder/completions"
    assert client.get(url).json() == []
    first = client.post(url, json={"level_ids": ["easy-a", "easy-b"]})
    assert (first.status_code, first.json()) == (200, ["easy-a", "easy-b"])
    again = client.post(url, json={"level_ids": ["easy-b", "easy-c", "easy-c"]})
    assert again.json() == ["easy-a", "easy-b", "easy-c"]
    assert client.get("/api/profiles/2/pathfinder/completions").json() == []


def test_completions_for_unknown_profile_is_404(client: httpx.Client) -> None:
    missing = client.get("/api/profiles/999999/pathfinder/completions")
    assert (missing.status_code, missing.json()) == (404, {"detail": "no profile with id 999999"})
    posted = client.post("/api/profiles/999999/pathfinder/completions", json={"level_ids": ["x"]})
    assert posted.status_code == 404


def test_map_create_list_round_trip(client: httpx.Client) -> None:
    created = client.post(MAPS, json=map_body("custom-rt"))
    assert created.status_code == 201
    assert created.json() == {
        "id": "custom-rt",
        "profile_id": 1,
        "name": "Kid_map1",
        "difficulty": "easy",
        "rows": 2,
        "columns": 2,
        "dots": list(DOTS),
        "published": False,
        "created_at": "2026-10-07T12:00:00",
    }
    assert [m["id"] for m in client.get(MAPS).json()] == ["custom-rt"]


def test_maps_list_newest_first_and_are_scoped_to_the_profile(client: httpx.Client) -> None:
    client.post(MAPS, json=map_body("custom-old"))
    client.post(MAPS, json=map_body("custom-new"))
    assert [m["id"] for m in client.get(MAPS).json()] == ["custom-new", "custom-old"]
    assert client.get(OTHER_MAPS).json() == []
    assert client.get("/api/profiles/999999/pathfinder/maps").status_code == 404


@pytest.mark.parametrize(
    ("overrides", "detail"),
    [
        ({"difficulty": "impossible"}, "difficulty must be one of ('easy', 'medium', 'hard', 'legendary')"),
        ({"name": "   "}, "name must not be empty"),
        ({"dots": []}, "a map needs at least one dot"),
    ],
)
def test_map_create_rejects_bad_input(client: httpx.Client, overrides: dict[str, object], detail: str) -> None:
    response = client.post(MAPS, json=map_body("custom-bad", **overrides))
    assert (response.status_code, response.json()) == (422, {"detail": detail})


def test_map_create_conflicts_on_a_taken_id(client: httpx.Client) -> None:
    assert client.post(MAPS, json=map_body("custom-dup")).status_code == 201
    duplicate = client.post(MAPS, json=map_body("custom-dup"))
    assert (duplicate.status_code, duplicate.json()) == (409, {"detail": "map custom-dup already exists"})


def test_map_rename_and_publish_keep_identity(client: httpx.Client) -> None:
    created = client.post(MAPS, json=map_body("custom-edit")).json()

    renamed = client.patch(f"{MAPS}/custom-edit", json={"name": "Spiral"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Spiral"
    assert renamed.json()["created_at"] == created["created_at"]

    published = client.patch(f"{MAPS}/custom-edit", json={"published": True})
    assert (published.json()["published"], published.json()["name"]) == (True, "Spiral")

    assert client.patch(f"{MAPS}/custom-edit", json={"name": " "}).status_code == 422


def test_map_delete(client: httpx.Client) -> None:
    client.post(MAPS, json=map_body("custom-del"))
    assert client.delete(f"{MAPS}/custom-del").status_code == 204
    assert client.get(MAPS).json() == []
    assert client.delete(f"{MAPS}/custom-del").status_code == 404


def test_one_profile_cannot_touch_another_profiles_map(client: httpx.Client) -> None:
    client.post(MAPS, json=map_body("custom-owned"))
    patched = client.patch(f"{OTHER_MAPS}/custom-owned", json={"name": "Mine now"})
    assert (patched.status_code, patched.json()) == (404, {"detail": "no map custom-owned for profile 2"})
    assert client.delete(f"{OTHER_MAPS}/custom-owned").status_code == 404


def test_published_maps_lists_every_profiles_published_maps_with_author(client: httpx.Client) -> None:
    client.post(MAPS, json=map_body("custom-pub", name="Shared"))
    client.post(MAPS, json=map_body("custom-private", name="Secret"))
    client.post(OTHER_MAPS, json=map_body("custom-other", name="Theirs"))
    client.patch(f"{MAPS}/custom-pub", json={"published": True})
    client.patch(f"{OTHER_MAPS}/custom-other", json={"published": True})

    response = client.get(PUBLISHED)
    assert response.status_code == 200
    rows = response.json()
    assert [row["id"] for row in rows] == ["custom-other", "custom-pub"]
    by_id = {row["id"]: row for row in rows}
    assert by_id["custom-pub"] == {
        "id": "custom-pub",
        "name": "Shared",
        "difficulty": "easy",
        "rows": 2,
        "columns": 2,
        "dots": list(DOTS),
        "author_profile_id": 1,
        "author_name": "Maker",
        "created_at": "2026-10-07T12:00:00",
    }
    assert by_id["custom-other"]["author_name"] == "Other"


def test_unpublished_map_drops_out_of_published_maps(client: httpx.Client) -> None:
    client.post(MAPS, json=map_body("custom-unpub"))
    client.patch(f"{MAPS}/custom-unpub", json={"published": True})
    assert [row["id"] for row in client.get(PUBLISHED).json()] == ["custom-unpub"]
    client.patch(f"{MAPS}/custom-unpub", json={"published": False})
    assert client.get(PUBLISHED).json() == []
