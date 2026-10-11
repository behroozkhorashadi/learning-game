"""Equation Builder: the first math game module — PRD §7.3, §16 step 9.

Digital fill-in-the-blank equation practice, e.g. "3 + [] = 7". One token of
a two-operand equation (an operand, the operator, or the answer) is blanked
out; the kid picks the tile that completes it from a tray of the correct
tile plus plausible-but-wrong distractors. Reuses the tile-assembly primitive
(`TileAssemblyItem`/`TileAssembly`, ported for Syllable Builder) with exactly
one slot, same as Syllable Builder reuses it with one slot per syllable.

The primary difficulty axis is the operand ceiling (PRD §14.5's "number
range"), which rises monotonically with level; allowed operations and which
token gets blanked escalate alongside it. Multi-step equations ("3 + 4 - 2 =
[]") are PRD §7.3's next rung and are deliberately out of scope here — this
sticks to one operation per item, matching M2's "freeze the game-module
contract" scope (PRD §16 step 9).
"""

from collections.abc import Mapping
from typing import NamedTuple, override

from app.play.games.arithmetic_reducers_pure import (
    ALL_OPERATORS as _ALL_OPERATORS,
)
from app.play.games.arithmetic_reducers_pure import (
    Fact,
    Operator,
    draw_operands,
    draw_operator_with_ramp,
    first_unseen,
    numeric_distractors,
    operator_distractors,
)
from app.play.games.arithmetic_reducers_pure import (
    apply_operator as _apply,
)
from app.play.games.game_module_reducers_pure import GameModule
from app.play.play_ports_pure import Rng
from app.play.play_schemas_pure import GameMetadata, Item

_ALL_MISSING_KINDS: tuple[str, ...] = ("left", "operator", "right", "answer")


class Tier(NamedTuple):
    """One difficulty rung — PRD §14.5: number range, allowed operations, and
    which token can be blanked all escalate together. `operand_max` is the
    primary axis (PRD §11: must be non-decreasing with level). `min_age` is
    the youngest PRD §4 persona this tier's operations typically suit — not a
    gate: a younger kid who keeps mastering levels is still promoted into it,
    just with progressively longer streaks required (see
    `typical_level_for_age` and `app.engine.loop_a.pace_for_age`)."""

    max_level: int
    operand_max: int
    operations: tuple[Operator, ...]
    missing_kinds: tuple[str, ...]
    min_age: int


# (each tier's max_level_inclusive) — explicit and monotonic on operand_max by
# construction, mirroring syllable_builder's `_LEVEL_THRESHOLDS`. `min_age` on
# the first three tiers matches this game's own `min_age=6` below (PRD §4's
# 6-year-old persona: addition/subtraction, "early number sense"); the last
# tier's `min_age=8` is where multiplication/division first belong (PRD §4's
# 9-year-old persona), matching `fact_fluency`'s own `min_age=8`.
TIERS: tuple[Tier, ...] = (
    Tier(max_level=2, operand_max=5, operations=("+",), missing_kinds=("answer",), min_age=6),
    Tier(max_level=4, operand_max=10, operations=("+", "-"), missing_kinds=("answer",), min_age=6),
    Tier(max_level=7, operand_max=12, operations=("+", "-"), missing_kinds=("answer", "left", "right"), min_age=6),
    Tier(max_level=10, operand_max=12, operations=_ALL_OPERATORS, missing_kinds=_ALL_MISSING_KINDS, min_age=8),
)


def tier_for_level(level: int) -> Tier:
    for tier in TIERS:
        if level <= tier.max_level:
            return tier
    return TIERS[-1]


def _tier_index_for_level(level: int) -> int:
    for index, tier in enumerate(TIERS):
        if level <= tier.max_level:
            return index
    return len(TIERS) - 1


def _tier_start_level(tier_index: int) -> int:
    """The first level belonging to `TIERS[tier_index]` — one past the
    previous tier's ceiling, or 1 for the first tier."""
    return 1 if tier_index == 0 else TIERS[tier_index - 1].max_level + 1


def _new_operations_for_tier(tier_index: int) -> tuple[Operator, ...]:
    """Operators `TIERS[tier_index]` has that the previous tier didn't —
    what `draw_operator_with_ramp` eases in gradually rather than at full
    weight from the tier's first level. Empty for the first tier (nothing to
    ramp against yet)."""
    if tier_index == 0:
        return ()
    previous_operations = set(TIERS[tier_index - 1].operations)
    return tuple(op for op in TIERS[tier_index].operations if op not in previous_operations)


def _tier_progress(level: int, tier_index: int) -> float:
    """How far `level` is through `TIERS[tier_index]`'s span — 0.0 at the
    tier's first level, 1.0 at its last."""
    start = _tier_start_level(tier_index)
    end = TIERS[tier_index].max_level
    if end <= start:
        return 1.0
    return (level - start) / (end - start)


def _typical_level_for_age(age: int) -> int:
    """Highest `Tier.max_level` among tiers this age has reached, per
    `Tier.min_age` — falls back to the first tier's ceiling for an age below
    every tier (never crashes on an out-of-range profile age)."""
    eligible = [tier.max_level for tier in TIERS if age >= tier.min_age]
    return max(eligible) if eligible else TIERS[0].max_level


def _starting_level_for_age(age: int) -> int:
    """Where a *brand-new* profile starts this game — the first level of the
    tier just *below* the highest one this age has reached (`_typical_level_for_age`),
    not level 1 for everyone: an older kid starts calibrated near their
    developmental level (PRD §4) instead of grinding through tiers clearly
    below it. Deliberately one tier short of the ceiling rather than landing
    right on it, so even a kid old enough for the hardest currently-unlocked
    tier still has to earn it via a genuine promotion — "slowly probe, don't
    jump" applies to the starting point too, not just the ceiling. Loop A's
    own promote/support rules do the actual fine-tuning from there, and
    `draw_operator_with_ramp` eases in anything a *later* tier introduces
    once promotion does get there."""
    ceiling_index = _tier_index_for_level(_typical_level_for_age(age))
    start_index = max(0, ceiling_index - 1)
    return _tier_start_level(start_index)


def _draw_operands(operator: Operator, tier: Tier, rng: Rng) -> tuple[int, int]:
    return draw_operands(operator, tier.operand_max, rng)


class Equation(NamedTuple):
    fact: Fact
    missing: str


class EquationBuilderGame(GameModule):
    metadata = GameMetadata(
        id="equation_builder",
        title="Equation Builder",
        tagline="Fill in the missing piece",
        skill_ids=["arithmetic_fluency"],
        min_age=6,
        max_age=11,
        icon="\U0001f9ee",
        max_level=10,
    )

    @override
    def typical_level_for_age(self, age: int) -> int:
        return _typical_level_for_age(age)

    @override
    def starting_level_for_age(self, age: int) -> int:
        return _starting_level_for_age(age)

    @override
    def generate_item(self, level: int, rng: Rng, exclude: frozenset[str] = frozenset()) -> Item:
        tier_index = _tier_index_for_level(level)
        tier = TIERS[tier_index]
        new_operations = _new_operations_for_tier(tier_index)
        progress = _tier_progress(level, tier_index)

        # No exhausted-pool fallback needed (unlike syllable_builder's small word lists).
        equation = first_unseen(
            lambda: self._draw_equation(tier, new_operations, progress, rng),
            lambda e: self._equation_key(e.fact.left, e.fact.operator, e.fact.right, e.fact.answer, e.missing),
            exclude,
        )
        left, operator, right, answer = equation.fact
        missing = equation.missing

        # Floor of 3 distractors (4 tiles total) even at level 1 — a 2-tile
        # tray makes the blank guessable without doing the arithmetic; growing
        # slowly past that keeps it a genuine multiple-choice pick as levels
        # rise. Operator-missing items can't reach this floor (only 3
        # operators exist in total, so at most 2 distractors), which is an
        # inherent ceiling of the operator vocabulary, not a bug.
        distractor_count = min(3 + level // 5, 5)
        tiles = self._build_tiles(tier, equation, distractor_count, rng)

        item_id = f"{self.metadata.id}-L{level}-{rng.getrandbits(32):08x}"
        return Item(
            item_id=item_id,
            game_id=self.metadata.id,
            level=level,
            payload={
                "left": left,
                "operator": operator,
                "right": right,
                "answer": answer,
                "missing": missing,
                "tiles": tiles,
            },
        )

    def _draw_equation(self, tier: Tier, new_operations: tuple[Operator, ...], progress: float, rng: Rng) -> Equation:
        operator = draw_operator_with_ramp(tier.operations, new_operations, progress, rng)
        left, right = _draw_operands(operator, tier, rng)
        missing = rng.choice(tier.missing_kinds)
        return Equation(Fact(left, operator, right, _apply(operator, left, right)), missing)

    def _equation_key(self, left: object, operator: object, right: object, answer: object, missing: object) -> str:
        return f"{left}{operator}{right}={answer}|{missing}"

    def _build_tiles(self, tier: Tier, equation: Equation, distractor_count: int, rng: Rng) -> list[str]:
        left, operator, right, answer = equation.fact
        missing = equation.missing
        if missing == "operator":
            correct = operator
            distractors = operator_distractors(operator, tier.operations, distractor_count)
        else:
            value = {"left": left, "right": right, "answer": answer}[missing]
            correct = str(value)
            # Operands must stay positive (a "0" tile reads as a typo, not a
            # choice, to a young kid); the answer may legitimately be 0.
            floor = 1 if missing in ("left", "right") else 0
            distractors = [str(d) for d in numeric_distractors(value, distractor_count, rng, floor=floor)]

        tiles = [correct, *distractors]
        rng.shuffle(tiles)
        return tiles

    @override
    def repeat_key(self, item_payload: Mapping[str, object]) -> str | None:
        return self._equation_key(
            item_payload.get("left"),
            item_payload.get("operator"),
            item_payload.get("right"),
            item_payload.get("answer"),
            item_payload.get("missing"),
        )
