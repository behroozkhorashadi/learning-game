"""GET/PUT/DELETE /api/practice-config over the real SQL repository, with the profile
and game lookups faked."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.practice.practice_repository_effect import make_sql_practice_config_repository
from app.practice.practice_routes_effect import bind_practice_routes
from app.practice.practice_service_effect import make_practice_service
from tests.practice.practice_fakes import OPERATORS, ManualClock, known_game

URL = "/api/practice-config"
QUERY = (("profile_id", 1), ("game_id", "fact_fluency"))


@pytest.fixture
def client(tmp_path: Path) -> httpx.Client:
    repository = make_sql_practice_config_repository(engine=create_engine(f"sqlite:///{tmp_path / 'practice.db'}"))
    repository.create_schema()
    service = make_practice_service(
        repository=repository,
        profile_exists=lambda profile_id: profile_id == 1,
        games=known_game,
        operators=OPERATORS,
        clock=ManualClock(),
    )
    app = FastAPI()
    app.include_router(bind_practice_routes(service=service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def put(client: httpx.Client, **overrides: object) -> httpx.Response:
    body: dict[str, object] = {**dict(QUERY), "operations": ["+", "-"], "focus_numbers": {}, "difficulty": 5}
    body.update(overrides)
    return client.put(URL, json=body)


def test_get_with_no_config_is_404(client: httpx.Client) -> None:
    response = client.get(URL, params=QUERY)
    assert response.status_code == 404
    assert response.json() == {"detail": "no practice config set for this profile/game"}


def test_put_then_get_round_trips(client: httpx.Client) -> None:
    put_response = put(client, operations=["×", "÷"], focus_numbers={"×": [7, 8]}, difficulty=8)
    assert put_response.status_code == 200
    assert put_response.json() == {
        "id": 1,
        "profile_id": 1,
        "game_id": "fact_fluency",
        "operations": ["×", "÷"],
        "focus_numbers": {"×": [7, 8]},
        "difficulty": 8,
        "updated_at": "2026-10-07T12:00:00",
    }
    assert client.get(URL, params=QUERY).json()["difficulty"] == 8


def test_put_again_updates_in_place_not_a_duplicate(client: httpx.Client) -> None:
    put(client, difficulty=3)
    second = put(client, difficulty=6).json()
    assert second["id"] == 1
    assert client.get(URL, params=QUERY).json()["difficulty"] == 6


def test_delete_reverts_to_no_config(client: httpx.Client) -> None:
    put(client)
    assert client.delete(URL, params=QUERY).status_code == 204
    assert client.get(URL, params=QUERY).status_code == 404


def test_delete_with_no_config_is_404(client: httpx.Client) -> None:
    assert client.delete(URL, params=QUERY).status_code == 404


@pytest.mark.parametrize(
    ("overrides", "detail"),
    [
        ({"operations": []}, "operations must not be empty"),
        ({"operations": ["%"]}, "operations must be a subset of ('+', '-', '×', '÷')"),
        ({"difficulty": 0}, "difficulty must be between 1 and 10"),
        ({"difficulty": 11}, "difficulty must be between 1 and 10"),
        ({"game_id": "syllable_builder"}, "syllable_builder does not support a practice config"),
    ],
)
def test_put_rejects_invalid_configs(client: httpx.Client, overrides: dict[str, object], detail: str) -> None:
    response = put(client, **overrides)
    assert response.status_code == 422
    assert response.json() == {"detail": detail}


def test_put_for_unknown_profile_or_game_is_404(client: httpx.Client) -> None:
    assert put(client, profile_id=999999).json() == {"detail": "no profile with id 999999"}
    unknown = put(client, game_id="nope")
    assert unknown.status_code == 404
    assert unknown.json() == {"detail": "\"no game registered with id 'nope'\""}
