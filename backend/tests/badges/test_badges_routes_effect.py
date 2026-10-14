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
    body = {badge["key"]: badge for badge in client.get("/api/profiles/1/badges").json()}
    assert body["word-wizard"] == {
        "key": "word-wizard",
        "name": "Word Wizard",
        "description": "Write and finish your first story",
        "art_url": "/images/achievements/word-wizard.png",
        "earned": True,
        "awarded_at": "2026-10-07T12:00:00",
        "category": "creator",
        "tier": "bronze",
        "earned_reason": "You wrote and finished your first story!",
        "progress": 1,
        "goal": 1,
        "earned_in_game": None,
        "art_status": "pending",
        "personal_art_url": None,
        "celebrated": False,
    }
    assert all(badge["earned"] == (badge["awarded_at"] is not None) for badge in body.values())


def test_new_badges_are_celebrated_then_gone(client: httpx.Client, badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    badges.service.evaluate(1, None)
    assert [b["key"] for b in client.get("/api/profiles/1/badges/new").json()] == ["word-wizard"]
    assert client.post("/api/profiles/1/badges/word-wizard/celebrated").status_code == 204
    assert client.get("/api/profiles/1/badges/new").json() == []


def test_painting_an_earned_badge_returns_it_with_its_art(client: httpx.Client, badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    badges.service.evaluate(1, None)
    painted = client.post("/api/profiles/1/badges/word-wizard/art")
    assert painted.status_code == 200
    assert (painted.json()["art_status"], painted.json()["personal_art_url"]) == ("ready", "/static/badge-art/1.webp")


def test_unearned_or_unknown_badges_cannot_be_painted_or_celebrated(client: httpx.Client) -> None:
    for action in ("art", "celebrated"):
        assert client.post(f"/api/profiles/1/badges/champion/{action}").status_code == 409
        assert client.post(f"/api/profiles/1/badges/nope/{action}").status_code == 404
        assert client.post(f"/api/profiles/999/badges/champion/{action}").status_code == 404
    assert client.get("/api/profiles/999/badges/new").status_code == 404


def test_stats_shape(client: httpx.Client, badges: BadgeHarness) -> None:
    badges.history.ratings.append(4)
    badges.history.attempt()
    body = client.get("/api/profiles/1/stats").json()
    assert set(body) == {
        "total_stars",
        "day_streak",
        "minutes_this_week",
        "most_played_game",
        "avg_rating",
        "last_session_at",
        "progress_delta_pct",
        "longest_streak",
        "total_minutes",
        "recent_days",
    }
    assert (body["total_stars"], body["avg_rating"]) == (4, 4.0)
    assert body["recent_days"] == [
        {"day": "2026-10-07", "minutes": 0, "rounds": 1, "correct": 1, "games": ["Syllable Builder"]}
    ]
