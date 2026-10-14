"""The live-derived stats read model — HANDOFF.md §4 — and the pure badge rules: the
seeded shelf, progress, streaks, the day-by-day breakdown, and the art prompt."""

from datetime import UTC, date, datetime, timedelta

from app.badges.badges_reducers_pure import (
    SEED_BADGES,
    active_minutes,
    badge_art_prompt,
    criteria_json,
    day_streak,
    earned_in_game,
    evaluation_order,
    longest_correct_streak,
    longest_day_streak,
    profile_stats,
    progress_toward,
    recent_days,
)
from app.badges.badges_schemas_pure import ArtRequest, Badge, BadgeCriteria, DayActivity
from tests.badges.badges_fakes import NOW, History, utc_day


def _title(game_id: str) -> str | None:
    return {"syllable_builder": "Syllable Builder", "zombie_horde": "Zombie Horde"}.get(game_id)


def _stats(history: History) -> dict[str, object]:
    return profile_stats(history.activity(1), today=NOW.date(), day_of=utc_day, game_title=_title).model_dump()


def _progress(criteria: BadgeCriteria, history: History) -> int | None:
    return progress_toward(criteria, history.activity(1), utc_day)


def test_stats_with_no_activity() -> None:
    assert _stats(History()) == {
        "total_stars": 0,
        "day_streak": 0,
        "minutes_this_week": 0,
        "most_played_game": None,
        "avg_rating": None,
        "last_session_at": None,
        "progress_delta_pct": None,
        "longest_streak": 0,
        "total_minutes": 0,
        "recent_days": (),
    }


def test_total_stars_and_average_rating() -> None:
    history = History(ratings=[4, 2])
    stats = _stats(history)
    assert (stats["total_stars"], stats["avg_rating"]) == (6, 3.0)


def test_minutes_count_time_between_events_and_skip_long_breaks() -> None:
    start = NOW.replace(hour=9)
    history = History(
        events=[
            start,
            start + timedelta(minutes=3),  # 3 minutes of play
            start + timedelta(minutes=5),  # 2 more
            start + timedelta(minutes=45),  # a 40-minute break: not counted
            start + timedelta(minutes=49),  # 4 more
            start - timedelta(days=10),  # last week: not this week
            start - timedelta(days=10) + timedelta(minutes=6),
        ]
    )
    stats = _stats(history)
    assert (stats["minutes_this_week"], stats["total_minutes"]) == (9, 9)


def test_active_minutes_never_join_two_days() -> None:
    late = datetime(2026, 10, 6, 23, 58, tzinfo=UTC)
    assert active_minutes([late, late + timedelta(minutes=4)], utc_day) == {}


def test_most_played_game_counts_attempts_and_pieces_and_falls_back_to_the_id() -> None:
    history = History(pieces=["prompt_forge", "prompt_forge"])
    for _ in range(3):
        history.attempt()
    assert _stats(history)["most_played_game"] == "Syllable Builder"
    assert _stats(History(pieces=["prompt_forge"]))["most_played_game"] == "prompt_forge"


def test_day_streak_longest_streak_and_last_session() -> None:
    history = History(events=[NOW - timedelta(days=offset) for offset in (0, 1, 2, 10, 11, 12, 13)])
    stats = _stats(history)
    assert (stats["day_streak"], stats["longest_streak"], stats["last_session_at"]) == (3, 4, NOW)


def test_the_current_streak_survives_until_a_whole_day_is_missed() -> None:
    today = NOW.date()
    played = {today - timedelta(days=offset) for offset in (1, 2, 3)}
    assert day_streak(played, today) == 3  # not yet today: still alive
    assert day_streak(played, today + timedelta(days=1)) == 0  # missed yesterday
    assert day_streak(set(), today) == 0
    assert longest_day_streak(played | {today - timedelta(days=9)}) == 3


def test_recent_days_break_each_day_down_newest_first() -> None:
    history = History(events=[NOW, NOW + timedelta(minutes=2), NOW - timedelta(days=1), NOW - timedelta(days=60)])
    history.attempt(game_id="zombie_horde")
    history.attempt(game_id="zombie_horde", correct=False)
    history.attempt(game_id="syllable_builder")
    history.attempt(days_ago=1, game_id="new_game")
    assert recent_days(history.activity(1), today=NOW.date(), day_of=utc_day, game_title=_title) == (
        DayActivity(day=NOW.date(), minutes=2, rounds=3, correct=2, games=("Zombie Horde", "Syllable Builder")),
        DayActivity(day=date(2026, 10, 6), minutes=0, rounds=1, correct=1, games=("new_game",)),
    )


def test_progress_delta_compares_this_month_with_last() -> None:
    history = History()
    history.attempt(correct=True, days_ago=0)
    history.attempt(correct=False, days_ago=30)
    history.attempt(correct=True, days_ago=31)
    assert _stats(history)["progress_delta_pct"] == 50
    only_this_month = History()
    only_this_month.attempt()
    assert _stats(only_this_month)["progress_delta_pct"] is None


def test_progress_for_the_day_time_and_variety_criteria() -> None:
    history = History(events=[NOW, NOW + timedelta(minutes=4), NOW - timedelta(days=1), NOW - timedelta(days=5)])
    history.attempt(game_id="zombie_horde", days_ago=2)
    history.pieces.append("prompt_forge")
    assert _progress(BadgeCriteria(type="day_streak", count=3), history) == 3
    assert _progress(BadgeCriteria(type="active_days", count=10), history) == 4
    assert _progress(BadgeCriteria(type="minutes_played", count=60), history) == 4
    assert _progress(BadgeCriteria(type="games_tried", count=3), history) == 2
    assert _progress(BadgeCriteria(type="all_other_badges"), history) is None
    assert _progress(BadgeCriteria(type="something_new"), history) is None


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


def test_the_shelf_has_unique_keys_and_champion_is_judged_last() -> None:
    keys = [seed.key for seed in SEED_BADGES]
    assert len(keys) == len(set(keys))
    champion = Badge(
        id=1, key="champion", name="C", description="d", art_url="u", criteria=BadgeCriteria(type="all_other_badges")
    )
    later = champion.model_copy(update={"id": 9, "key": "x", "criteria": BadgeCriteria(type="attempts_total")})
    assert [badge.key for badge in evaluation_order([champion, later])] == ["x", "champion"]


def test_earned_in_game_is_the_last_game_played_before_the_award() -> None:
    history = History()
    history.attempt(game_id="syllable_builder", days_ago=2)
    history.attempt(game_id="zombie_horde", days_ago=1)
    history.attempt(game_id="syllable_builder", days_ago=0)
    stored_award_time = (NOW - timedelta(hours=1)).replace(tzinfo=None)  # stored times come back naive
    assert earned_in_game(history.attempts, stored_award_time) == "zombie_horde"
    assert earned_in_game(history.attempts, NOW - timedelta(days=5)) is None


def test_the_art_prompt_personalizes_without_asking_for_words() -> None:
    request = ArtRequest(
        badge_name="On a Roll", tier="gold", art_theme="a campfire", favorite_game="Zombie Horde", mascot="fox"
    )
    prompt = badge_art_prompt(request)
    assert "a campfire" in prompt
    assert "golden glow" in prompt
    assert "no border, rim" in prompt
    assert "cartoon fox mascot" in prompt
    assert "Zombie Horde" in prompt
    assert "No words, letters, or numbers" in prompt
    plain = badge_art_prompt(ArtRequest(badge_name="X", tier="bronze", art_theme="t", favorite_game=None, mascot=None))
    assert "mascot" not in plain
    assert "favorite game" not in plain
