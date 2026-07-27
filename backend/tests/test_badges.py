"""Badge awarding + stats tests — HANDOFF.md §4.

Two layers: `evaluate_and_award_badges`/`compute_profile_stats` are tested
directly against an isolated in-memory engine (so exact counts are safe to
assert), and the two new endpoints are smoke-tested through the shared
`client` fixture. Profile 1's Attempt/Rating history is shared with
test_api.py (which runs alphabetically first), so the endpoint tests only
assert deltas or "eventually true" outcomes, never exact totals.
"""

from datetime import timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.models.attempt import Attempt
from app.models.badge import Badge, BadgeAward
from app.models.enums import EventType, RatingScale
from app.models.event import Event
from app.models.piece import Piece
from app.models.profile import Profile
from app.models.rating import Rating
from app.services.badges_service import (
    SEED_BADGES,
    compute_profile_stats,
    evaluate_and_award_badges,
    seed_badges,
)
from app.util import utcnow


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(Profile(id=1, name="Test Kid", avatar="fox", birth_year=2020))
        s.commit()
        yield s


def _attempt(session, *, game_id="syllable_builder", correct=True, time_ms=5000, created_at=None):
    attempt = Attempt(
        item_id="item",
        profile_id=1,
        game_id=game_id,
        level=1,
        correct=correct,
        hints_used=0,
        time_ms=time_ms,
    )
    if created_at is not None:
        attempt.created_at = created_at
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def _keys(badges):
    return {b.key for b in badges}


def test_seed_badges_creates_the_six_expected_badges(session):
    seed_badges(session)

    badges = session.exec(select(Badge)).all()
    assert {b.key for b in badges} == {e["key"] for e in SEED_BADGES}


def test_seed_badges_is_idempotent(session):
    seed_badges(session)
    seed_badges(session)

    assert len(session.exec(select(Badge)).all()) == len(SEED_BADGES)


def test_no_badges_awarded_with_no_activity(session):
    seed_badges(session)

    assert evaluate_and_award_badges(session, profile_id=1) == []
    assert session.exec(select(BadgeAward)).all() == []


def test_word_wizard_awarded_after_first_piece(session):
    seed_badges(session)
    session.add(Piece(profile_id=1, game_id="prompt_forge", body="hi"))
    session.commit()

    awarded = evaluate_and_award_badges(session, profile_id=1)

    assert _keys(awarded) == {"word-wizard"}


def test_sound_master_awarded_after_20_correct_syllable_builder_attempts(session):
    seed_badges(session)
    for _ in range(19):
        _attempt(session, time_ms=9000)
    assert "sound-master" not in _keys(evaluate_and_award_badges(session, profile_id=1))

    _attempt(session, time_ms=9000)
    assert "sound-master" in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_sound_master_ignores_attempts_in_other_games(session):
    seed_badges(session)
    for _ in range(20):
        _attempt(session, game_id="prompt_forge", time_ms=9000)

    assert "sound-master" not in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_quick_builder_needs_five_fast_correct_attempts(session):
    seed_badges(session)
    for _ in range(4):
        _attempt(session, time_ms=3000)
    assert "quick-builder" not in _keys(evaluate_and_award_badges(session, profile_id=1))

    _attempt(session, time_ms=3000)
    assert "quick-builder" in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_quick_builder_ignores_slow_attempts(session):
    seed_badges(session)
    for _ in range(10):
        _attempt(session, time_ms=9000)

    assert "quick-builder" not in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_pattern_pro_needs_a_ten_correct_streak(session):
    seed_badges(session)
    for _ in range(9):
        _attempt(session, time_ms=9000, correct=True)
    _attempt(session, time_ms=9000, correct=False)
    assert "pattern-pro" not in _keys(evaluate_and_award_badges(session, profile_id=1))

    for _ in range(10):
        _attempt(session, time_ms=9000, correct=True)
    assert "pattern-pro" in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_speed_demon_needs_fifty_total_attempts_regardless_of_correctness(session):
    seed_badges(session)
    for _ in range(49):
        _attempt(session, time_ms=9000, correct=False)
    assert "speed-demon" not in _keys(evaluate_and_award_badges(session, profile_id=1))

    _attempt(session, time_ms=9000, correct=False)
    assert "speed-demon" in _keys(evaluate_and_award_badges(session, profile_id=1))


def test_champion_awarded_once_every_other_badge_is_earned_in_the_same_pass(session):
    seed_badges(session)
    session.add(Piece(profile_id=1, game_id="prompt_forge", body="hi"))
    session.commit()
    for _ in range(50):
        _attempt(session, time_ms=3000, correct=True)

    awarded = evaluate_and_award_badges(session, profile_id=1)

    assert _keys(awarded) == {e["key"] for e in SEED_BADGES}


def test_champion_not_awarded_if_one_other_badge_is_missing(session):
    seed_badges(session)
    # Everything except word-wizard (no Piece ever created).
    for _ in range(50):
        _attempt(session, time_ms=3000, correct=True)

    awarded = evaluate_and_award_badges(session, profile_id=1)

    assert "champion" not in _keys(awarded)


def test_evaluate_and_award_badges_is_idempotent(session):
    seed_badges(session)
    session.add(Piece(profile_id=1, game_id="prompt_forge", body="hi"))
    session.commit()

    first = evaluate_and_award_badges(session, profile_id=1)
    second = evaluate_and_award_badges(session, profile_id=1)

    assert _keys(first) == {"word-wizard"}
    assert second == []
    assert len(session.exec(select(BadgeAward)).all()) == 1


def test_stats_with_no_activity(session):
    stats = compute_profile_stats(session, 1)

    assert stats.total_stars == 0
    assert stats.avg_rating is None
    assert stats.day_streak == 0
    assert stats.minutes_this_week == 0
    assert stats.most_played_game is None
    assert stats.last_session_at is None
    assert stats.progress_delta_pct is None


def test_stats_total_stars_and_avg_rating(session):
    session.add(Rating(profile_id=1, game_id="syllable_builder", scale=RatingScale.STARS_1_5, value=4))
    session.add(Rating(profile_id=1, game_id="syllable_builder", scale=RatingScale.STARS_1_5, value=2))
    session.commit()

    stats = compute_profile_stats(session, 1)

    assert stats.total_stars == 6
    assert stats.avg_rating == 3.0


def test_stats_minutes_this_week_excludes_attempts_from_last_week(session):
    now = utcnow()
    _attempt(session, time_ms=60000, created_at=now)
    _attempt(session, time_ms=120000, created_at=now - timedelta(days=10))

    stats = compute_profile_stats(session, 1)

    assert stats.minutes_this_week == 1


def test_stats_most_played_game_counts_attempts_and_pieces(session):
    for _ in range(3):
        _attempt(session, game_id="syllable_builder")
    session.add(Piece(profile_id=1, game_id="prompt_forge", body="hi"))
    session.add(Piece(profile_id=1, game_id="prompt_forge", body="ho"))
    session.commit()

    stats = compute_profile_stats(session, 1)

    assert stats.most_played_game == "Syllable Builder"


def test_stats_day_streak_counts_consecutive_active_days(session):
    now = utcnow()
    for offset in range(3):
        session.add(
            Event(profile_id=1, game_id="x", event_type=EventType.ATTEMPT, payload={}, timestamp=now - timedelta(days=offset))
        )
    session.add(
        Event(profile_id=1, game_id="x", event_type=EventType.ATTEMPT, payload={}, timestamp=now - timedelta(days=10))
    )
    session.commit()

    stats = compute_profile_stats(session, 1)

    assert stats.day_streak == 3


def _post_attempt(client, *, time_ms=3000, correct=True):
    item = client.get(
        "/api/items/next", params={"profile_id": 1, "game_id": "syllable_builder"}
    ).json()
    response = client.post(
        "/api/attempts",
        json={
            "item_id": item["item_id"],
            "profile_id": 1,
            "game_id": "syllable_builder",
            "telemetry": {"correct": correct, "hints_used": 0, "time_ms": time_ms},
            "details": {},
        },
    )
    assert response.status_code == 201
    return response.json()


def test_get_badges_for_unknown_profile_is_404(client):
    assert client.get("/api/profiles/999/badges").status_code == 404


def test_get_stats_for_unknown_profile_is_404(client):
    assert client.get("/api/profiles/999/stats").status_code == 404


def test_get_badges_lists_all_seeded_badges_with_earned_status(client):
    response = client.get("/api/profiles/1/badges")

    assert response.status_code == 200
    body = response.json()
    assert {b["key"] for b in body} == {e["key"] for e in SEED_BADGES}
    for badge in body:
        assert isinstance(badge["earned"], bool)
        assert badge["earned"] == (badge["awarded_at"] is not None)


def test_get_stats_returns_the_expected_shape(client):
    response = client.get("/api/profiles/1/stats")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "total_stars",
        "day_streak",
        "minutes_this_week",
        "most_played_game",
        "avg_rating",
        "last_session_at",
        "progress_delta_pct",
    }
    # test_api.py has already given profile 1 one 4-star rating.
    assert body["total_stars"] >= 4
    assert body["avg_rating"] is not None


def test_posting_enough_fast_correct_attempts_awards_quick_builder(client):
    def quick_builder_earned() -> bool:
        badges = {b["key"]: b for b in client.get("/api/profiles/1/badges").json()}
        return badges["quick-builder"]["earned"]

    for _ in range(10):
        if quick_builder_earned():
            break
        _post_attempt(client, time_ms=3000)

    assert quick_builder_earned()
