from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.badges.badges_routes_effect import bind_badges_routes
from tests.badges.badges_fakes import BadgeHarness, badge_harness


@pytest.fixture
def badges(tmp_path: Path) -> BadgeHarness:
    return badge_harness(tmp_path)


@pytest.fixture
def client(badges: BadgeHarness) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_badges_routes(service=badges.service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_unknown_profile_is_404(client: httpx.Client) -> None:
    for url in ("/api/profiles/999/badges", "/api/profiles/999/stats"):
        response = client.get(url)
        assert (response.status_code, response.json()) == (404, {"detail": "no profile with id 999"})


def test_badges_list_every_seeded_badge_with_earned_status(client: httpx.Client, badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    badges.service.evaluate(1, None)
    body = client.get("/api/profiles/1/badges").json()
    assert body[0] == {
        "key": "word-wizard",
        "name": "Word Wizard",
        "description": "Wrote and finished your first story",
        "art_url": "/images/achievements/word-wizard.png",
        "earned": True,
        "awarded_at": "2026-10-07T12:00:00",
    }
    assert all(badge["earned"] == (badge["awarded_at"] is not None) for badge in body)


def test_stats_shape(client: httpx.Client, badges: BadgeHarness) -> None:
    badges.history.ratings.append(4)
    body = client.get("/api/profiles/1/stats").json()
    assert set(body) == {
        "total_stars",
        "day_streak",
        "minutes_this_week",
        "most_played_game",
        "avg_rating",
        "last_session_at",
        "progress_delta_pct",
    }
    assert (body["total_stars"], body["avg_rating"]) == (4, 4.0)
