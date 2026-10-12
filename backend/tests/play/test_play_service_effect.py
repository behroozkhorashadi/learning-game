"""Loop A wired to storage and the event log — PRD §5.1, §6, §11: a level change is
persisted with a reasoned `difficulty_changed` event, the frustration guard and the
confidence item work across requests, and age paces (never caps) promotion. The pure
rules themselves are covered in test_loop_a_reducers_pure.py."""

from pathlib import Path

import pytest

from app.events.events_schemas_pure import EventType
from app.play.play_ports_pure import AttemptNotFoundError, ProfileNotFoundError, UnknownGameError
from app.play.play_schemas_pure import (
    AttemptCreate,
    AttemptRead,
    Level,
    PracticeSettings,
    RatingCreate,
    RatingScale,
    TelemetryCore,
    VerificationCreate,
)
from tests.play.play_fakes import START, YEAR, PlayHarness, play_harness, str_at

GAME_ID = "syllable_builder"


@pytest.fixture
def play(tmp_path: Path) -> PlayHarness:
    return play_harness(tmp_path, birth_years={1: YEAR - 6, 2: YEAR - 9, 3: YEAR - 11})


def play_round(
    play: PlayHarness,
    *,
    correct: bool,
    profile_id: int = 1,
    game_id: str = GAME_ID,
    time_ms: int = 1000,
    session_id: str | None = None,
) -> AttemptRead:
    item = play.service.next_item(profile_id, game_id, session_id)
    return play.service.record_attempt(
        AttemptCreate(
            item_id=item.item_id,
            profile_id=profile_id,
            game_id=game_id,
            session_id=session_id,
            telemetry=TelemetryCore(correct=correct, hints_used=0, time_ms=time_ms),
        )
    )


def level_of(play: PlayHarness, profile_id: int = 1, game_id: str = GAME_ID) -> int:
    level = play.level(profile_id, game_id)
    return 1 if level is None else level.value


def test_promote_persists_level_change_and_appends_reasoned_event(play: PlayHarness) -> None:
    for _ in range(5):
        play_round(play, correct=True)
    assert level_of(play) == 2
    changes = play.events_of(1, EventType.DIFFICULTY_CHANGED)
    assert len(changes) == 1
    assert (changes[0].payload["from"], changes[0].payload["to"]) == (1, 2)
    assert str_at(changes[0].payload, "reason")


def test_hold_band_does_not_change_level_or_append_event(play: PlayHarness) -> None:
    for correct in (True, True, True, False, False):
        play_round(play, correct=correct)
    assert level_of(play) == 1
    assert play.events_of(1, EventType.DIFFICULTY_CHANGED) == []


def test_frustration_guard_offers_hint_on_second_consecutive_wrong(play: PlayHarness) -> None:
    assert play_round(play, correct=False).hint_offered is False
    assert play_round(play, correct=False).hint_offered is True
    # The guard never changes the level, and fires before the window (K=5) is full.
    assert level_of(play) == 1
    assert play.events_of(1, EventType.DIFFICULTY_CHANGED) == []


def test_support_serves_a_confidence_item_on_the_next_request_only(play: PlayHarness) -> None:
    for _ in range(10):  # promote twice, so a support has room to drop
        play_round(play, correct=True)
    assert level_of(play) == 3
    for _ in range(5):
        play_round(play, correct=False)
    assert level_of(play) == 2
    assert play.events_of(1, EventType.DIFFICULTY_CHANGED)[-1].payload["needs_confidence_item"] is True

    confidence = play.service.next_item(1, GAME_ID, None)
    assert confidence.level == 1  # one below the new current level
    assert play.events_of(1, EventType.ITEM_SHOWN)[-1].payload["pacing"] == "confidence"

    play.service.next_item(1, GAME_ID, None)  # self-expires once an item has been shown
    assert play.events_of(1, EventType.ITEM_SHOWN)[-1].payload["pacing"] != "confidence"


def test_a_young_kid_who_keeps_mastering_is_promoted_past_their_age_level(play: PlayHarness) -> None:
    """Age sets the pace, never a ceiling: a 6-year-old acing equation_builder reaches
    the ×/÷ tier (level 8+), which is typical from age 8."""
    for _ in range(100):
        play_round(play, correct=True, game_id="equation_builder")
    assert level_of(play, game_id="equation_builder") >= 8


def test_promotion_past_age_level_needs_a_longer_streak(play: PlayHarness) -> None:
    """A 9-year-old in fact_fluency at L6 (the top of the age-typical +/- range): the
    usual 3 fast correct answers no longer promote; a 4th does."""
    play.repository.save_level(Level(profile_id=2, game_id="fact_fluency", value=6, updated_at=START))
    for _ in range(3):
        play_round(play, correct=True, profile_id=2, game_id="fact_fluency", time_ms=1500)
    assert level_of(play, 2, "fact_fluency") == 6
    play_round(play, correct=True, profile_id=2, game_id="fact_fluency", time_ms=1500)
    assert level_of(play, 2, "fact_fluency") == 7


def test_a_brand_new_older_profiles_first_item_starts_above_level_one(play: PlayHarness) -> None:
    assert play.service.next_item(3, "equation_builder", None).level > 1


def test_no_repeats_within_a_session(play: PlayHarness) -> None:
    words = [str_at(play.service.next_item(1, GAME_ID, "s1").payload, "target_word") for _ in range(6)]
    assert len(set(words)) == len(words)


def test_an_attempt_is_logged_once_and_reported_for_badges(play: PlayHarness) -> None:
    read = play_round(play, correct=True, session_id="s1")
    attempts = play.events_of(1, EventType.ATTEMPT)
    assert [event.event_id for event in attempts] == [read.event_id]
    assert attempts[0].payload["attempt_id"] == read.id
    assert play.attempts_reported == [(1, "s1")]


def test_an_active_practice_config_replaces_the_adaptive_level(play: PlayHarness) -> None:
    play.practice[(2, "fact_fluency")] = PracticeSettings(difficulty=2, operations=("+",), focus_numbers={})
    for _ in range(30):
        item = play.service.next_item(2, "fact_fluency", None)
        assert item.payload["operator"] == "+"
    assert play.events_of(2, EventType.ITEM_SHOWN)[-1].payload["pacing"] == "practice_config"
    assert play.level(2, "fact_fluency") is None  # Loop A's level was never consulted


def test_unknown_profiles_games_and_attempts(play: PlayHarness) -> None:
    with pytest.raises(ProfileNotFoundError):
        play.service.next_item(99, GAME_ID, None)
    with pytest.raises(UnknownGameError):
        play.service.next_item(1, "nope", None)
    with pytest.raises(ProfileNotFoundError):
        play.service.record_rating(RatingCreate(profile_id=99, game_id=GAME_ID, scale=RatingScale.FACES, value=3))
    with pytest.raises(AttemptNotFoundError):
        play.service.record_verification(VerificationCreate(attempt_id=999, correct=True))


def test_ratings_and_verifications_append_one_event_each(play: PlayHarness) -> None:
    rating = play.service.record_rating(
        RatingCreate(profile_id=1, game_id=GAME_ID, scale=RatingScale.STARS_1_5, value=4)
    )
    assert play.events_of(1, EventType.RATING_GIVEN)[0].payload == {
        "rating_id": rating.id,
        "scale": "stars_1_5",
        "value": 4,
    }
    attempt = play_round(play, correct=True, session_id="s1")
    verification = play.service.record_verification(VerificationCreate(attempt_id=attempt.id, correct=True))
    events = play.events_of(1, EventType.VERIFICATION_COMPLETED)
    assert len(events) == 1
    assert events[0].session_id == "s1"
    assert events[0].payload == {"verification_id": verification.id, "attempt_id": attempt.id, "correct": True}


def test_games_titles_and_rules_for_other_features(play: PlayHarness) -> None:
    assert [game.id for game in play.service.list_games()][:3] == [
        "syllable_builder",
        "equation_builder",
        "fact_fluency",
    ]
    assert play.service.game_title("fact_fluency") == "Equation Outbreak"
    assert play.service.game_title("nope") is None
    rules = play.service.game_rules("fact_fluency")
    assert rules is not None
    assert (rules.supports_practice_config, rules.max_level) == (True, 12)
    assert play.service.game_rules("nope") is None
