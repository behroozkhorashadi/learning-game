"""The play endpoints over HTTP — PRD §6, §11: the telemetry-core floor is enforced on
POST /api/attempts, and each write appends exactly one event."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.events.events_schemas_pure import EventType
from app.play.play_routes_effect import bind_play_routes
from tests.play.play_fakes import PlayHarness, play_harness


@pytest.fixture
def play(tmp_path: Path) -> PlayHarness:
    return play_harness(tmp_path)


@pytest.fixture
def client(play: PlayHarness) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_play_routes(service=play.service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def item(client: httpx.Client) -> dict[str, object]:
    response = client.get("/api/items/next", params={"profile_id": 1, "game_id": "syllable_builder"})
    assert response.status_code == 200
    body: dict[str, object] = response.json()
    return body


def attempt(client: httpx.Client, **telemetry: object) -> httpx.Response:
    served = item(client)
    return client.post(
        "/api/attempts",
        json={
            "item_id": served["item_id"],
            "profile_id": 1,
            "game_id": "syllable_builder",
            "telemetry": telemetry,
            "details": {},
        },
    )


def test_games_are_listed(client: httpx.Client) -> None:
    games = client.get("/api/games").json()
    assert games[0] == {
        "id": "syllable_builder",
        "title": "Syllable Builder",
        "tagline": "Slide the sounds",
        "skill_ids": ["phonics"],
        "min_age": 5,
        "max_age": 8,
        "icon": "\U0001f9e9",
        "max_level": 10,
    }


def test_next_item_shape_and_unknown_profile_or_game(client: httpx.Client) -> None:
    served = item(client)
    assert set(served) == {"item_id", "game_id", "variant_id", "level", "payload"}
    missing = client.get("/api/items/next", params={"profile_id": 99, "game_id": "syllable_builder"})
    assert (missing.status_code, missing.json()) == (404, {"detail": "no profile with id 99"})
    unknown = client.get("/api/items/next", params={"profile_id": 1, "game_id": "nope"})
    assert (unknown.status_code, unknown.json()) == (404, {"detail": "\"no game registered with id 'nope'\""})


def test_attempt_missing_telemetry_core_is_rejected(client: httpx.Client, play: PlayHarness) -> None:
    assert attempt(client, hints_used=0, time_ms=1000).status_code == 422
    assert play.events_of(1, EventType.ATTEMPT) == []


def test_valid_attempt_appends_exactly_one_event(client: httpx.Client, play: PlayHarness) -> None:
    response = attempt(client, correct=True, hints_used=0, time_ms=3000)
    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": 1,
        "correct": True,
        "score": None,
        "hints_used": 0,
        "time_ms": 3000,
        "event_id": body["event_id"],
        "hint_offered": False,
    }
    assert [event.event_id for event in play.events_of(1, EventType.ATTEMPT)] == [body["event_id"]]


def test_rating_validation_and_one_event(client: httpx.Client, play: PlayHarness) -> None:
    rating = {"profile_id": 1, "game_id": "syllable_builder", "scale": "stars_1_5"}
    assert client.post("/api/ratings", json={**rating, "value": 6}).status_code == 422
    assert client.post("/api/ratings", json={**rating, "profile_id": 999, "value": 5}).status_code == 404
    response = client.post("/api/ratings", json={**rating, "value": 4})
    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "profile_id": 1,
        "game_id": "syllable_builder",
        "variant_id": None,
        "scale": "stars_1_5",
        "value": 4,
        "created_at": response.json()["created_at"],
    }
    assert len(play.events_of(1, EventType.RATING_GIVEN)) == 1


def test_verification_for_unknown_attempt_is_rejected(client: httpx.Client) -> None:
    response = client.post("/api/verifications", json={"attempt_id": 999999, "correct": True})
    assert (response.status_code, response.json()) == (404, {"detail": "no attempt with id 999999"})


def test_valid_verification_appends_exactly_one_event(client: httpx.Client, play: PlayHarness) -> None:
    attempt_id = attempt(client, correct=True, hints_used=0, time_ms=3000).json()["id"]
    response = client.post("/api/verifications", json={"attempt_id": attempt_id, "correct": True})
    assert response.status_code == 201
    body = response.json()
    assert (body["attempt_id"], body["correct"], body["verified_by"]) == (attempt_id, True, "parent")
    assert len(play.events_of(1, EventType.VERIFICATION_COMPLETED)) == 1
