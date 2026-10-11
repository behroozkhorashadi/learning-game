"""The live-derived stats read model — HANDOFF.md §4."""

from datetime import timedelta

from app.badges.badges_reducers_pure import criteria_json, day_streak, longest_correct_streak, profile_stats
from app.badges.badges_schemas_pure import BadgeCriteria
from tests.badges.badges_fakes import NOW, History


def _title(game_id: str) -> str | None:
    return {"syllable_builder": "Syllable Builder"}.get(game_id)


def _stats(history: History) -> dict[str, object]:
    return profile_stats(history.activity(1), today=NOW.date(), game_title=_title).model_dump()


def test_stats_with_no_activity() -> None:
    assert _stats(History()) == {
        "total_stars": 0,
        "day_streak": 0,
        "minutes_this_week": 0,
        "most_played_game": None,
        "avg_rating": None,
        "last_session_at": None,
        "progress_delta_pct": None,
    }


def test_total_stars_and_average_rating() -> None:
    history = History(ratings=[4, 2])
    stats = _stats(history)
    assert (stats["total_stars"], stats["avg_rating"]) == (6, 3.0)


def test_minutes_this_week_excludes_last_week() -> None:
    history = History()
    history.attempt(time_ms=60000)
    history.attempt(time_ms=120000, days_ago=10)
    assert _stats(history)["minutes_this_week"] == 1


def test_most_played_game_counts_attempts_and_pieces_and_falls_back_to_the_id() -> None:
    history = History(pieces=["prompt_forge", "prompt_forge"])
    for _ in range(3):
        history.attempt()
    assert _stats(history)["most_played_game"] == "Syllable Builder"
    assert _stats(History(pieces=["prompt_forge"]))["most_played_game"] == "prompt_forge"


def test_day_streak_and_last_session_come_from_events() -> None:
    history = History(events=[NOW - timedelta(days=offset) for offset in (0, 1, 2, 10)])
    stats = _stats(history)
    assert (stats["day_streak"], stats["last_session_at"]) == (3, NOW)
    assert day_streak(set()) == 0


def test_progress_delta_compares_this_month_with_last() -> None:
    history = History()
    history.attempt(correct=True, days_ago=0)
    history.attempt(correct=False, days_ago=30)
    history.attempt(correct=True, days_ago=31)
    assert _stats(history)["progress_delta_pct"] == 50
    only_this_month = History()
    only_this_month.attempt()
    assert _stats(only_this_month)["progress_delta_pct"] is None


def test_streaks_and_stored_criteria_shape() -> None:
    history = History()
    for correct in (True, True, False, True, True, True):
        history.attempt(correct=correct)
    assert longest_correct_streak(history.attempts) == 3
    assert criteria_json(BadgeCriteria(type="attempts_correct", count=20, game_id="syllable_builder")) == {
        "type": "attempts_correct",
        "count": 20,
        "game_id": "syllable_builder",
    }
    assert criteria_json(BadgeCriteria(type="all_other_badges")) == {"type": "all_other_badges"}
