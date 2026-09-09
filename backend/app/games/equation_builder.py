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

from typing import Any, NamedTuple, Optional
from random import Random

from app.games._arithmetic import (
    ALL_OPERATORS as _ALL_OPERATORS,
    Operator,
    apply_operator as _apply,
    draw_operands,
    numeric_distractors,
    operator_distractors,
)
from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item

_ALL_MISSING_KINDS: tuple[str, ...] = ("left", "operator", "right", "answer")


class Tier(NamedTuple):
    """One difficulty rung — PRD §14.5: number range, allowed operations, and
    which token can be blanked all escalate together. `operand_max` is the
    primary axis (PRD §11: must be non-decreasing with level)."""

    max_level: int
    operand_max: int
    operations: tuple[Operator, ...]
    missing_kinds: tuple[str, ...]


# (each tier's max_level_inclusive) — explicit and monotonic on operand_max by
# construction, mirroring syllable_builder's `_LEVEL_THRESHOLDS`.
_TIERS: list[Tier] = [
    Tier(max_level=2, operand_max=5, operations=("+",), missing_kinds=("answer",)),
    Tier(max_level=4, operand_max=10, operations=("+", "-"), missing_kinds=("answer",)),
    Tier(max_level=7, operand_max=12, operations=("+", "-"), missing_kinds=("answer", "left", "right")),
    Tier(max_level=10, operand_max=12, operations=_ALL_OPERATORS, missing_kinds=_ALL_MISSING_KINDS),
]


def _tier_for_level(level: int) -> Tier:
    for tier in _TIERS:
        if level <= tier.max_level:
            return tier
    return _TIERS[-1]


def _draw_operands(operator: Operator, tier: Tier, rng: Random) -> tuple[int, int]:
    return draw_operands(operator, tier.operand_max, rng)


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

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        tier = _tier_for_level(level)

        # Equations are generated, not drawn from a fixed bank, so the pool is
        # effectively unbounded — a handful of retries is enough to dodge a
        # same-session repeat without the exhausted-pool fallback syllable_builder
        # needs for its small curated word lists.
        for _ in range(10):
            left, operator, right, missing = self._draw_equation(tier, rng)
            answer = _apply(operator, left, right)
            candidate_key = self._equation_key(left, operator, right, answer, missing)
            if candidate_key not in exclude:
                break

        # Floor of 3 distractors (4 tiles total) even at level 1 — a 2-tile
        # tray makes the blank guessable without doing the arithmetic; growing
        # slowly past that keeps it a genuine multiple-choice pick as levels
        # rise. Operator-missing items can't reach this floor (only 3
        # operators exist in total, so at most 2 distractors), which is an
        # inherent ceiling of the operator vocabulary, not a bug.
        distractor_count = min(3 + level // 5, 5)
        tiles = self._build_tiles(tier, left, operator, right, answer, missing, distractor_count, rng)

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

    def _draw_equation(self, tier: Tier, rng: Random) -> tuple[int, Operator, int, str]:
        operator = rng.choice(tier.operations)
        left, right = _draw_operands(operator, tier, rng)
        missing = rng.choice(tier.missing_kinds)
        return left, operator, right, missing

    def _equation_key(self, left: int, operator: Operator, right: int, answer: int, missing: str) -> str:
        return f"{left}{operator}{right}={answer}|{missing}"

    def _build_tiles(
        self,
        tier: Tier,
        left: int,
        operator: Operator,
        right: int,
        answer: int,
        missing: str,
        distractor_count: int,
        rng: Random,
    ) -> list[str]:
        if missing == "operator":
            correct: Any = operator
            distractors: list[Any] = operator_distractors(operator, tier.operations, distractor_count)
        else:
            correct = {"left": left, "right": right, "answer": answer}[missing]
            # Operands must stay positive (a "0" tile reads as a typo, not a
            # choice, to a young kid); the answer may legitimately be 0.
            floor = 1 if missing in ("left", "right") else 0
            distractors = numeric_distractors(correct, distractor_count, rng, floor=floor)

        tiles = [str(correct)] + [str(d) for d in distractors]
        rng.shuffle(tiles)
        return tiles

    def repeat_key(self, item_payload: dict[str, Any]) -> Optional[str]:
        return self._equation_key(
            item_payload.get("left"),
            item_payload.get("operator"),
            item_payload.get("right"),
            item_payload.get("answer"),
            item_payload.get("missing"),
        )


register(EquationBuilderGame())
