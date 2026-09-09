"""Shared arithmetic-fact generation — used by both `equation_builder` and
`fact_fluency`. Neither game imports the other; this is the common ground
between "build the equation" and "tap-the-answer speed rounds" (PRD §7.3,
§14.5), factored out once a second game needed the exact same draw-a-fact/
generate-plausible-wrong-answers logic rather than a copy of it.
"""

from random import Random

Operator = str  # one of "+", "-", "×"

ALL_OPERATORS: tuple[Operator, ...] = ("+", "-", "×")

# A distractor generation retry loop can in principle need extra room to find
# enough distinct wrong values around very small numbers (e.g. left=1); this
# bounds how far it searches before giving up and returning fewer than asked.
_MAX_DISTRACTOR_SEARCH_RADIUS = 12


def apply_operator(operator: Operator, left: int, right: int) -> int:
    if operator == "+":
        return left + right
    if operator == "-":
        return left - right
    return left * right


def draw_operands(operator: Operator, operand_max: int, rng: Random) -> tuple[int, int]:
    """Draws (left, right) so the equation is always well-formed for a young
    kid: subtraction never goes negative, and multiplication stays within a
    times-table-sized range even at a tier whose operand_max is otherwise
    larger (PRD §14.5 leaves the exact range per operation as an implementation
    detail)."""
    if operator == "+":
        return rng.randint(1, operand_max), rng.randint(1, operand_max)
    if operator == "-":
        left = rng.randint(1, operand_max)
        right = rng.randint(0, left)
        return left, right
    cap = min(operand_max, 10)
    return rng.randint(1, cap), rng.randint(1, cap)


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
