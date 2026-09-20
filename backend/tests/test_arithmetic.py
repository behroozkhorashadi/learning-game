"""Unit tests for app/games/_arithmetic.py's shared operand-drawing logic —
division must always divide evenly, and the focus-biased drawing must
actually favor (without exclusively using) the requested numbers."""

from random import Random

from app.games._arithmetic import ALL_OPERATORS, apply_operator, draw_operands, draw_operands_with_focus


def test_division_always_divides_evenly():
    for seed in range(200):
        left, right = draw_operands("÷", 12, Random(seed))
        assert right != 0
        assert left % right == 0
        assert apply_operator("÷", left, right) == left // right


def test_division_answer_never_exceeds_the_times_table_cap():
    for seed in range(200):
        left, right = draw_operands("÷", 12, Random(seed))
        assert 1 <= left // right <= 10


def test_all_operators_produce_well_formed_operands():
    for operator in ALL_OPERATORS:
        for seed in range(100):
            left, right = draw_operands(operator, 12, Random(seed))
            answer = apply_operator(operator, left, right)
            if operator == "-":
                assert answer >= 0
            if operator == "÷":
                assert left % right == 0


def test_focus_numbers_dominate_but_not_exclusively():
    rng = Random(1)
    hits = 0
    trials = 300
    for _ in range(trials):
        left, right = draw_operands_with_focus("×", 12, rng, [7, 8])
        if 7 in (left, right) or 8 in (left, right):
            hits += 1
    # "Most, but not all" — expect a clear majority but not every draw.
    assert trials * 0.6 < hits < trials


def test_focus_still_produces_well_formed_equations_for_every_operator():
    for operator in ALL_OPERATORS:
        rng = Random(3)
        for _ in range(100):
            left, right = draw_operands_with_focus(operator, 12, rng, [7, 8])
            answer = apply_operator(operator, left, right)
            if operator == "-":
                assert answer >= 0
            if operator == "÷":
                assert left % right == 0


def test_no_focus_numbers_behaves_like_plain_draw():
    # Not a strict determinism check (draw_operands_with_focus still consumes
    # an extra random() call before falling back) — just confirms it doesn't
    # blow up and stays within bounds when there's nothing to focus on.
    for seed in range(50):
        left, right = draw_operands_with_focus("+", 10, Random(seed), None)
        assert 1 <= left <= 10
        assert 1 <= right <= 10


def test_focus_number_outside_operand_range_falls_back_gracefully():
    for seed in range(50):
        left, right = draw_operands_with_focus("×", 5, Random(seed), [99])
        assert apply_operator("×", left, right) == left * right
