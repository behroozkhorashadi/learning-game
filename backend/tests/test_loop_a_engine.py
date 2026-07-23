"""Pure unit tests for the Loop A engine — PRD §5.1, §11.

`app.engine.loop_a` takes no DB/session fixtures on purpose: it is a pure
function of (level, window, config, max_level) to (decision) or
(level, max_level, rng, config) to (directive). These tests exercise it
directly, in isolation from persistence.
"""

from random import Random

import pytest

from app.engine.loop_a import (
    LevelAction,
    LoopAConfig,
    NextItemKind,
    WindowAttempt,
    check_frustration_guard,
    evaluate_level,
    select_next_item_level,
)

DEFAULT = LoopAConfig()


def _window(pattern: list[bool], hints: int = 0) -> list[WindowAttempt]:
    return [WindowAttempt(correct=c, hints_used=hints) for c in pattern]


# --- evaluate_level: promote / hold / support -------------------------------


def test_promote_fires_on_high_accuracy_low_hints():
    window = _window([True, True, True, True, True], hints=0)
    decision = evaluate_level(3, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.PROMOTE
    assert decision.level == 4
    assert decision.changed is True
    assert decision.reset_window is True


def test_hold_fires_in_the_middle_band():
    # 3/5 correct = 0.6 accuracy, within [0.5, 0.8).
    window = _window([True, True, True, False, False], hints=0)
    decision = evaluate_level(3, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.HOLD
    assert decision.level == 3
    assert decision.changed is False
    assert decision.reset_window is False


def test_support_fires_below_half_accuracy():
    window = _window([False, False, False, True, False], hints=0)  # 1/5 = 0.2
    decision = evaluate_level(3, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.SUPPORT
    assert decision.level == 2
    assert decision.changed is True
    assert decision.reset_window is True
    assert decision.needs_confidence_item is True
    assert decision.show_encouragement is True


def test_support_never_drops_below_level_1():
    window = _window([False, False, False, False, False])
    decision = evaluate_level(1, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.SUPPORT
    assert decision.level == 1
    assert decision.changed is False
    assert decision.reset_window is False


def test_promote_never_exceeds_the_games_max_level():
    window = _window([True, True, True, True, True], hints=0)
    decision = evaluate_level(10, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.PROMOTE
    assert decision.level == 10
    assert decision.changed is False
    assert decision.reset_window is False


def test_high_accuracy_but_high_hint_rate_does_not_promote():
    # 5/5 correct but hint_rate == 1.0, not strictly below threshold (1.0).
    window = _window([True, True, True, True, True], hints=1)
    decision = evaluate_level(3, window, max_level=10, config=DEFAULT)
    assert decision.action != LevelAction.PROMOTE
    assert decision.changed is False


def test_rules_do_not_fire_until_window_is_full():
    window = _window([True, True, True, True])  # K=5, only 4 attempts
    decision = evaluate_level(3, window, max_level=10, config=DEFAULT)
    assert decision.action == LevelAction.PENDING
    assert decision.changed is False
    assert decision.level == 3


def test_window_only_resets_on_promote_or_support_not_hold():
    hold = evaluate_level(3, _window([True, True, True, False, False]), max_level=10, config=DEFAULT)
    promote = evaluate_level(3, _window([True] * 5), max_level=10, config=DEFAULT)
    support = evaluate_level(3, _window([False] * 5), max_level=10, config=DEFAULT)
    assert hold.reset_window is False
    assert promote.reset_window is True
    assert support.reset_window is True


@pytest.mark.parametrize(
    "window,current_level,max_level",
    [
        (_window([True] * 5), 4, 10),
        (_window([True, True, True, False, False]), 4, 10),
        (_window([False] * 5), 4, 10),
    ],
)
def test_every_level_change_has_a_non_empty_reason(window, current_level, max_level):
    decision = evaluate_level(current_level, window, max_level, config=DEFAULT)
    assert isinstance(decision.reason, str)
    assert len(decision.reason) > 0


def test_promote_reason_mentions_new_level_and_counts():
    decision = evaluate_level(3, _window([True] * 5, hints=0), max_level=10, config=DEFAULT)
    assert "L4" in decision.reason
    assert "5/5" in decision.reason


# --- frustration guard --------------------------------------------------


def test_frustration_guard_fires_on_two_consecutive_wrong():
    window = _window([True, False, False])
    assert check_frustration_guard(window) is True


def test_frustration_guard_does_not_fire_on_alternating_wrong():
    window = _window([False, True, False])
    assert check_frustration_guard(window) is False


def test_frustration_guard_does_not_fire_with_fewer_than_two_attempts():
    assert check_frustration_guard([]) is False
    assert check_frustration_guard(_window([False])) is False


def test_frustration_guard_never_changes_level():
    # Guard is a separate cadence from evaluate_level; verify by construction:
    # check_frustration_guard has no level/config/max_level parameters at all,
    # so it structurally cannot return or influence a level.
    import inspect

    params = inspect.signature(check_frustration_guard).parameters
    assert set(params) == {"window"}


def test_frustration_guard_fires_even_when_window_not_full():
    window = _window([False, False])  # K=5, window far from full
    assert check_frustration_guard(window) is True


# --- select_next_item_level: session pacing -----------------------------


def test_pacing_is_deterministic_under_fixed_seed():
    seq_a = [
        select_next_item_level(5, 10, Random(123), DEFAULT).kind for _ in range(50)
    ]
    seq_b = [
        select_next_item_level(5, 10, Random(123), DEFAULT).kind for _ in range(50)
    ]
    assert seq_a == seq_b


def test_pacing_distribution_is_roughly_80_20_at_level_vs_below():
    config = LoopAConfig(stretch_probability=0.0)  # isolate the 80/20 split
    rng = Random(7)
    kinds = [select_next_item_level(5, 10, rng, config).kind for _ in range(4000)]
    at_level = kinds.count(NextItemKind.AT_LEVEL)
    below_level = kinds.count(NextItemKind.BELOW_LEVEL)
    assert at_level + below_level == len(kinds)
    ratio = at_level / len(kinds)
    assert 0.75 <= ratio <= 0.85


def test_pacing_never_selects_below_the_floor():
    config = LoopAConfig(below_level_probability=1.0, stretch_probability=0.0)
    rng = Random(1)
    for _ in range(50):
        directive = select_next_item_level(1, 10, rng, config)
        assert directive.level >= 1


def test_pacing_never_selects_above_the_ceiling():
    config = LoopAConfig(stretch_probability=1.0)
    rng = Random(1)
    for _ in range(50):
        directive = select_next_item_level(10, 10, rng, config)
        assert directive.level <= 10


def test_confidence_item_served_immediately_after_support():
    directive = select_next_item_level(3, 10, Random(0), DEFAULT, force_confidence_item=True)
    assert directive.kind == NextItemKind.CONFIDENCE
    assert directive.level == 2


def test_confidence_item_floored_at_min_level():
    directive = select_next_item_level(1, 10, Random(0), DEFAULT, force_confidence_item=True)
    assert directive.kind == NextItemKind.CONFIDENCE
    assert directive.level == 1
