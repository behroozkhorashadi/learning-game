"""Division always divides evenly, and focus-biased drawing favors (without exclusively
using) the requested numbers."""

from app.play.games.arithmetic_reducers_pure import (
    ALL_OPERATORS,
    MAX_REPEAT_DRAWS,
    apply_operator,
    draw_operands,
    draw_operands_with_focus,
    draw_operator_with_ramp,
    first_unseen,
)
from tests.play.play_fakes import SeededRng


def test_division_always_divides_evenly_within_the_times_table() -> None:
    for seed in range(200):
        left, right = draw_operands("÷", 12, SeededRng(seed))
        assert right != 0
        assert left % right == 0
        assert apply_operator("÷", left, right) == left // right
        assert 1 <= left // right <= 10


def test_all_operators_produce_well_formed_operands() -> None:
    for operator in ALL_OPERATORS:
        for seed in range(100):
            left, right = draw_operands(operator, 12, SeededRng(seed))
            answer = apply_operator(operator, left, right)
            if operator == "-":
                assert answer >= 0
            if operator == "÷":
                assert left % right == 0


def test_focus_numbers_dominate_but_not_exclusively() -> None:
    rng = SeededRng(1)
    trials = 300
    hits = 0
    for _ in range(trials):
        left, right = draw_operands_with_focus("×", 12, rng, [7, 8])
        hits += 7 in (left, right) or 8 in (left, right)
    assert trials * 0.6 < hits < trials


def test_focus_still_produces_well_formed_equations_for_every_operator() -> None:
    for operator in ALL_OPERATORS:
        rng = SeededRng(3)
        for _ in range(100):
            left, right = draw_operands_with_focus(operator, 12, rng, [7, 8])
            answer = apply_operator(operator, left, right)
            if operator == "-":
                assert answer >= 0
            if operator == "÷":
                assert left % right == 0


def test_no_focus_or_an_unusable_focus_falls_back_to_a_plain_draw() -> None:
    for seed in range(50):
        left, right = draw_operands_with_focus("+", 10, SeededRng(seed), None)
        assert 1 <= left <= 10
        assert 1 <= right <= 10
        left, right = draw_operands_with_focus("×", 5, SeededRng(seed), [99])
        assert apply_operator("×", left, right) == left * right


def _new_operator_share(progress: float, seed: int, trials: int = 2000) -> float:
    rng = SeededRng(seed)
    hits = sum(
        1
        for _ in range(trials)
        if draw_operator_with_ramp(("+", "-", "×", "÷"), ("×", "÷"), progress, rng) in ("×", "÷")
    )
    return hits / trials


def test_ramp_starts_low_and_climbs_to_the_natural_share() -> None:
    """ "Slowly probe, don't jump": a new operator pair shows up rarely at the start of the
    tier that adds it and reaches its full share only by the tier's last level."""
    start_share = _new_operator_share(progress=0.0, seed=1)
    mid_share = _new_operator_share(progress=0.5, seed=2)
    end_share = _new_operator_share(progress=1.0, seed=3)
    assert start_share < 0.20
    assert start_share < mid_share < end_share
    assert 0.45 < end_share < 0.55


def test_ramp_is_a_plain_uniform_choice_when_nothing_or_everything_is_new() -> None:
    for seed in range(50):
        assert draw_operator_with_ramp(("+", "-"), (), progress=0.0, rng=SeededRng(seed)) in ("+", "-")
        assert draw_operator_with_ramp(("+", "-"), ("+", "-"), progress=0.0, rng=SeededRng(seed)) in ("+", "-")


def test_first_unseen_retries_then_gives_up_with_the_last_draw() -> None:
    draws = iter(range(100))
    assert first_unseen(lambda: next(draws), str, frozenset({"0", "1"})) == 2
    always = iter(range(100))
    assert first_unseen(lambda: next(always), lambda _n: "seen", frozenset({"seen"})) == MAX_REPEAT_DRAWS - 1
