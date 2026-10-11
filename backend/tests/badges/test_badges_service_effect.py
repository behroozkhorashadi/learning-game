"""Badge awarding — HANDOFF.md §4: each seeded badge's criteria against a profile's
history, idempotent, with "champion" seeing the rest of the same pass."""

from pathlib import Path

import pytest

from app.badges.badges_ports_pure import ProfileNotFoundError
from app.badges.badges_reducers_pure import SEED_BADGES
from tests.badges.badges_fakes import BadgeHarness, badge_harness

ALL_KEYS = frozenset(seed.key for seed in SEED_BADGES)


@pytest.fixture
def badges(tmp_path: Path) -> BadgeHarness:
    return badge_harness(tmp_path)


def evaluate(badges: BadgeHarness) -> set[str]:
    return set(badges.service.evaluate(1, None))


def test_seeding_creates_the_six_badges_once(badges: BadgeHarness) -> None:
    badges.service.seed()
    assert {badge.key for badge in badges.repository.badges()} == ALL_KEYS
    assert len(badges.repository.badges()) == len(SEED_BADGES)


def test_no_badges_awarded_with_no_activity(badges: BadgeHarness) -> None:
    assert evaluate(badges) == set()
    assert badges.repository.awards(1) == {}


def test_word_wizard_after_first_piece_and_an_event_per_award(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    assert badges.service.evaluate(1, "s1") == ("word-wizard",)
    assert badges.events.appended == [("badge_awarded", {"badge_id": 1, "badge_key": "word-wizard"})]


def test_sound_master_needs_20_correct_syllable_builder_attempts(badges: BadgeHarness) -> None:
    for _ in range(20):
        badges.history.attempt(game_id="prompt_forge", time_ms=9000)
    for _ in range(19):
        badges.history.attempt(time_ms=9000)
    assert "sound-master" not in evaluate(badges)
    badges.history.attempt(time_ms=9000)
    assert "sound-master" in evaluate(badges)


def test_quick_builder_needs_five_fast_correct_attempts(badges: BadgeHarness) -> None:
    for _ in range(10):
        badges.history.attempt(time_ms=9000)
    for _ in range(4):
        badges.history.attempt(time_ms=3000)
    assert "quick-builder" not in evaluate(badges)
    badges.history.attempt(time_ms=3000)
    assert "quick-builder" in evaluate(badges)


def test_pattern_pro_needs_a_ten_correct_streak(badges: BadgeHarness) -> None:
    for _ in range(9):
        badges.history.attempt(time_ms=9000)
    badges.history.attempt(time_ms=9000, correct=False)
    assert "pattern-pro" not in evaluate(badges)
    for _ in range(10):
        badges.history.attempt(time_ms=9000)
    assert "pattern-pro" in evaluate(badges)


def test_speed_demon_needs_fifty_attempts_regardless_of_correctness(badges: BadgeHarness) -> None:
    for _ in range(49):
        badges.history.attempt(time_ms=9000, correct=False)
    assert "speed-demon" not in evaluate(badges)
    badges.history.attempt(time_ms=9000, correct=False)
    assert "speed-demon" in evaluate(badges)


def test_champion_in_the_same_pass_only_when_every_other_badge_is_earned(tmp_path: Path) -> None:
    almost = badge_harness(tmp_path / "almost")
    for _ in range(50):
        almost.history.attempt(time_ms=3000)
    assert "champion" not in evaluate(almost)  # no piece, so no word-wizard

    everything = badge_harness(tmp_path / "everything")
    everything.history.pieces.append("prompt_forge")
    for _ in range(50):
        everything.history.attempt(time_ms=3000)
    assert evaluate(everything) == ALL_KEYS


def test_evaluation_is_idempotent(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    assert evaluate(badges) == {"word-wizard"}
    assert evaluate(badges) == set()
    assert len(badges.repository.awards(1)) == 1


def test_the_shelf_lists_every_badge_with_earned_status(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    evaluate(badges)
    shelf = {status.key: status for status in badges.service.badges_for(1)}
    assert set(shelf) == ALL_KEYS
    assert shelf["word-wizard"].earned
    assert shelf["word-wizard"].awarded_at is not None
    assert (shelf["champion"].earned, shelf["champion"].awarded_at) == (False, None)
    assert shelf["champion"].art_url == "/images/achievements/champion.png"


def test_unknown_profile(badges: BadgeHarness) -> None:
    with pytest.raises(ProfileNotFoundError):
        badges.service.badges_for(99)
    with pytest.raises(ProfileNotFoundError):
        badges.service.stats_for(99)
