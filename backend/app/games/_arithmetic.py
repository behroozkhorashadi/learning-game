"""Shared arithmetic-fact generation — used by both `equation_builder` and
`fact_fluency`. Neither game imports the other; this is the common ground
between "build the equation" and "tap-the-answer speed rounds" (PRD §7.3,
§14.5), factored out once a second game needed the exact same draw-a-fact/
generate-plausible-wrong-answers logic rather than a copy of it.
"""

from random import Random
from typing import Optional

Operator = str  # one of "+", "-", "×", "÷"

ALL_OPERATORS: tuple[Operator, ...] = ("+", "-", "×", "÷")

# A distractor generation retry loop can in principle need extra room to find
# enough distinct wrong values around very small numbers (e.g. left=1); this
# bounds how far it searches before giving up and returning fewer than asked.
_MAX_DISTRACTOR_SEARCH_RADIUS = 12


# Floor share for a newly-introduced operator right at the start of the tier
# that adds it — small enough to feel like an occasional preview rather than
# a coin flip, big enough that it's not so rare a session never sees it.
_NEW_OPERATOR_FLOOR_SHARE = 0.15


def draw_operator_with_ramp(
    operations: tuple[Operator, ...],
    new_operations: tuple[Operator, ...],
    progress: float,
    rng: Random,
) -> Operator:
    """Chooses an operator from `operations`, ramping in `new_operations` (the
    subset of `operations` this difficulty tier adds that the previous tier
    didn't have) gradually rather than at full weight from that tier's very
    first level — "the adaptive engine should slowly probe more difficulty,
    not jump," applied the same way regardless of which specific operators a
    game's tiers happen to introduce. `progress` is how far through the tier
    we are (0.0 at its first level, 1.0 at its last); the new operators'
    combined share ramps linearly from a small floor up to their natural
    equal share of the full operator set.

    Falls back to a plain uniform choice when there's nothing to ramp:
    `new_operations` empty (this tier adds nothing new) or every operator in
    `operations` is "new" (there's no "old" pool to ramp against — the very
    first tier)."""
    old_operations = tuple(op for op in operations if op not in new_operations)
    if not new_operations or not old_operations:
        return rng.choice(operations)

    natural_share = len(new_operations) / len(operations)
    progress = max(0.0, min(1.0, progress))
    new_share = _NEW_OPERATOR_FLOOR_SHARE + (natural_share - _NEW_OPERATOR_FLOOR_SHARE) * progress

    if rng.random() < new_share:
        return rng.choice(new_operations)
    return rng.choice(old_operations)


def apply_operator(operator: Operator, left: int, right: int) -> int:
    if operator == "+":
        return left + right
    if operator == "-":
        return left - right
    if operator == "÷":
        return left // right
    return left * right


# Multiplication/division stay within a times-table-sized range even at a
# tier whose operand_max is otherwise larger — matches the existing
# multiplication cap in draw_operands (PRD §14.5 leaves the exact per-operation
# range as an implementation detail).
_TIMES_TABLE_CAP = 10


def draw_operands(operator: Operator, operand_max: int, rng: Random) -> tuple[int, int]:
    """Draws (left, right) so the equation is always well-formed for a young
    kid: subtraction never goes negative, division always divides evenly
    (never a remainder), and multiplication/division stay within a
    times-table-sized range even at a tier whose operand_max is otherwise
    larger."""
    if operator == "+":
        return rng.randint(1, operand_max), rng.randint(1, operand_max)
    if operator == "-":
        left = rng.randint(1, operand_max)
        right = rng.randint(0, left)
        return left, right
    cap = min(operand_max, _TIMES_TABLE_CAP)
    if operator == "÷":
        divisor = rng.randint(1, cap)
        quotient = rng.randint(1, cap)
        return divisor * quotient, divisor
    return rng.randint(1, cap), rng.randint(1, cap)


def draw_operands_with_focus(
    operator: Operator, operand_max: int, rng: Random, focus_numbers: Optional[list[int]], focus_probability: float = 0.75
) -> tuple[int, int]:
    """Same as `draw_operands`, but when `focus_numbers` is non-empty, most
    (not all — `focus_probability`) draws pin one operand to a number from
    that list, so a parent's "focus on 7 and 8" produces a majority of 7s-
    and 8s-table facts without making every single problem one of them.

    Falls back to a plain `draw_operands` whenever there's nothing usable to
    focus on (no focus numbers, the probability roll misses, or the chosen
    focus number doesn't fit this operator's cap) — every branch below stays
    well-formed for the same reasons `draw_operands` is."""
    cap = min(operand_max, _TIMES_TABLE_CAP) if operator in ("×", "÷") else operand_max
    usable = [n for n in (focus_numbers or []) if 1 <= n <= cap]
    if not usable or rng.random() >= focus_probability:
        return draw_operands(operator, operand_max, rng)

    focus = rng.choice(usable)
    if operator == "+":
        other = rng.randint(1, operand_max)
        return (focus, other) if rng.random() < 0.5 else (other, focus)
    if operator == "-":
        # Put focus as the minuend (left) or subtrahend (right), whichever
        # keeps the result non-negative.
        if rng.random() < 0.5:
            right = rng.randint(0, focus)
            return focus, right
        left = rng.randint(focus, operand_max)
        return left, focus
    if operator == "×":
        other = rng.randint(1, cap)
        return (focus, other) if rng.random() < 0.5 else (other, focus)
    # "÷": focus as the divisor or the quotient, whichever role.
    other = rng.randint(1, cap)
    if rng.random() < 0.5:
        return focus * other, focus  # focus is the divisor
    return other * focus, other  # focus is the quotient


def numeric_distractors(correct: int, count: int, rng: Random, *, floor: int = 0) -> list[int]:
    """Plausible-but-wrong nearby numbers — close enough to require actually
    computing the answer rather than eliminating by magnitude alone."""
    seen = {correct}
    out: list[int] = []
    radius = 1
    while len(out) < count and radius <= _MAX_DISTRACTOR_SEARCH_RADIUS:
        for delta in (radius, -radius):
            candidate = correct + delta
            if candidate < floor or candidate in seen:
                continue
            seen.add(candidate)
            out.append(candidate)
            if len(out) == count:
                break
        radius += 1
    return out


def operator_distractors(correct: Operator, allowed: tuple[Operator, ...], count: int) -> list[Operator]:
    pool = [op for op in allowed if op != correct]
    if len(pool) < count:
        pool = [op for op in ALL_OPERATORS if op != correct]
    return pool[:count]
