"""Badge awarding — HANDOFF.md §4: each seeded badge's criteria against a profile's
history, idempotent, with "champion" seeing the rest of the same pass; then each new
award's personal art and celebration."""

from pathlib import Path

import pytest

from app.badges.badges_ports_pure import BadgeNotEarnedError, BadgeNotFoundError, ProfileNotFoundError
from app.badges.badges_reducers_pure import SEED_BADGES
from tests.badges.badges_fakes import NOW, BadgeHarness, badge_harness

ALL_KEYS = frozenset(seed.key for seed in SEED_BADGES)


@pytest.fixture
def badges(tmp_path: Path) -> BadgeHarness:
    return badge_harness(tmp_path)


def evaluate(badges: BadgeHarness) -> set[str]:
    return set(badges.service.evaluate(1, None))


def test_seeding_creates_every_badge_once(badges: BadgeHarness) -> None:
    badges.service.seed()
    assert {badge.key for badge in badges.repository.badges()} == ALL_KEYS
    assert len(badges.repository.badges()) == len(SEED_BADGES)


def test_no_badges_awarded_with_no_activity(badges: BadgeHarness) -> None:
    assert evaluate(badges) == set()
    assert badges.repository.awards(1) == {}


def test_word_wizard_after_first_piece_and_an_event_per_award(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    assert badges.service.evaluate(1, "s1") == ("word-wizard",)
    word_wizard = next(b.id for b in badges.repository.badges() if b.key == "word-wizard")
    assert badges.events.appended == [("badge_awarded", {"badge_id": word_wizard, "badge_key": "word-wizard"})]


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


def test_champion_in_the_same_pass_only_when_every_other_badge_is_earned(badges: BadgeHarness) -> None:
    by_key = {badge.key: badge.id for badge in badges.repository.badges()}
    for key, badge_id in by_key.items():
        if key not in {"champion", "word-wizard", "storyteller"}:
            badges.repository.award(1, badge_id, None, NOW)
    badges.history.pieces.append("prompt_forge")
    assert evaluate(badges) == {"word-wizard"}  # storyteller still missing

    badges.history.pieces.extend(["prompt_forge"] * 4)
    assert evaluate(badges) == {"storyteller", "champion"}


def test_evaluation_is_idempotent(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    assert evaluate(badges) == {"word-wizard"}
    assert evaluate(badges) == set()
    assert len(badges.repository.awards(1)) == 1


def test_the_shelf_lists_every_badge_with_progress_and_why_it_was_earned(badges: BadgeHarness) -> None:
    for _ in range(12):
        badges.history.attempt(game_id="zombie_horde", time_ms=9000)
    evaluate(badges)
    shelf = {status.key: status for status in badges.service.badges_for(1)}
    assert set(shelf) == ALL_KEYS
    pattern = shelf["pattern-pro"]
    assert (pattern.earned, pattern.awarded_at is not None, pattern.tier, pattern.category) == (
        True,
        True,
        "bronze",
        "accuracy",
    )
    assert (pattern.progress, pattern.goal) == (12, 10)  # keeps counting past the goal
    assert pattern.earned_reason == "You got 10 answers right in a row!"
    assert pattern.earned_in_game == "Zombie Horde"
    sharp = shelf["sharpshooter"]
    assert (sharp.earned, sharp.awarded_at, sharp.earned_reason, sharp.earned_in_game) == (False, None, None, None)
    assert (sharp.progress, sharp.goal, sharp.description) == (12, 25, "Get 25 answers right in a row")
    assert (shelf["champion"].progress, shelf["champion"].goal) == (1, len(ALL_KEYS) - 1)
    assert shelf["champion"].art_url == "/images/achievements/champion.png"


def test_the_shelf_catches_up_on_badges_added_since_the_last_play(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")  # no evaluate yet, as if seeded after playing
    shelf = {status.key: status for status in badges.service.badges_for(1)}
    assert shelf["word-wizard"].earned
    assert shelf["word-wizard"].earned_in_game is None  # a story, not a game's answers


def test_a_new_badge_paints_its_art_later_and_waits_to_be_celebrated(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    evaluate(badges)
    [new] = badges.service.uncelebrated(1)
    assert (new.key, new.art_status, new.personal_art_url, new.celebrated) == ("word-wizard", "pending", None, False)

    badges.jobs.run_all()
    [painted] = badges.service.uncelebrated(1)
    assert (painted.art_status, painted.personal_art_url) == ("ready", "/static/badge-art/1.webp")
    assert "Word Wizard" in badges.painter.prompts[0]
    assert "cartoon fox mascot" in badges.painter.prompts[0]

    badges.service.mark_celebrated(1, "word-wizard")
    assert badges.service.uncelebrated(1) == ()
    assert {s.key: s for s in badges.service.badges_for(1)}["word-wizard"].celebrated


def test_celebrating_while_the_art_paints_is_not_undone_when_it_lands(badges: BadgeHarness) -> None:
    badges.history.pieces.append("prompt_forge")
    evaluate(badges)
    badges.service.mark_celebrated(1, "word-wizard")
    badges.jobs.run_all()
    assert badges.service.uncelebrated(1) == ()
    assert {s.key: s for s in badges.service.badges_for(1)}["word-wizard"].art_status == "ready"


def test_failed_art_can_be_painted_again(badges: BadgeHarness) -> None:
    badges.painter.failing = True
    badges.history.pieces.append("prompt_forge")
    evaluate(badges)
    badges.jobs.run_all()
    assert badges.service.uncelebrated(1)[0].art_status == "failed"

    badges.painter.failing = False
    repainted = badges.service.paint(1, "word-wizard")
    assert (repainted.art_status, repainted.personal_art_url, repainted.celebrated) == (
        "ready",
        "/static/badge-art/1.webp",
        False,
    )


def test_an_award_from_before_art_and_celebrations_can_still_be_painted(badges: BadgeHarness) -> None:
    word_wizard = next(b.id for b in badges.repository.badges() if b.key == "word-wizard")
    badges.repository.award(1, word_wizard, None, NOW)
    old = {s.key: s for s in badges.service.badges_for(1)}["word-wizard"]
    assert (old.art_status, old.celebrated) == ("none", True)
    badges.service.mark_celebrated(1, "word-wizard")  # nothing owed; no error
    assert badges.service.paint(1, "word-wizard").art_status == "ready"
    assert badges.service.uncelebrated(1) == ()


def test_only_earned_badges_can_be_painted_or_celebrated(badges: BadgeHarness) -> None:
    with pytest.raises(BadgeNotEarnedError):
        badges.service.paint(1, "champion")
    with pytest.raises(BadgeNotEarnedError):
        badges.service.mark_celebrated(1, "champion")
    with pytest.raises(BadgeNotFoundError):
        badges.service.paint(1, "no-such-badge")


def test_a_photo_avatar_sends_no_mascot(tmp_path: Path) -> None:
    badges = badge_harness(tmp_path, mascot=None)
    badges.history.pieces.append("prompt_forge")
    evaluate(badges)
    badges.jobs.run_all()
    assert "mascot" not in badges.painter.prompts[0]


def test_unknown_profile(badges: BadgeHarness) -> None:
    with pytest.raises(ProfileNotFoundError):
        badges.service.badges_for(99)
    with pytest.raises(ProfileNotFoundError):
        badges.service.stats_for(99)
    with pytest.raises(ProfileNotFoundError):
        badges.service.uncelebrated(99)
