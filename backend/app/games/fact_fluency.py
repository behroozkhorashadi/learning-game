"""Fact Fluency: tap-the-answer speed rounds — PRD §7.3's "Fact Fluency (math,
9/11): operation, number range, time pressure on/off."

Server-side this looks a lot like `equation_builder` (same underlying
arithmetic-fact generation, shared via `app.games._arithmetic`), but it's a
distinct game module rather than a mode of Equation Builder: the missing
piece is always the final answer (never an operand or operator — picking
that out of a *moving* multiple-choice tray under time pressure is already
the whole exercise), and difficulty carries a second axis Equation Builder
doesn't have: `approach_ms`, how long a kid has to answer before time runs
out. Time pressure is PRD §14.5's difficulty knob for this game, and PRD §6
says "the server owns difficulty and level selection" — so the pacing lives
here, not as a client-side guess.

The client's presentation of "time runs out" (a themed on-screen approach —
zombies in the current build) is entirely a frontend concern and can be
reskinned freely without touching this module; nothing here is zombie-shaped.
"""

from random import Random
from typing import Any, NamedTuple, Optional

from app.games._arithmetic import (
    ALL_OPERATORS,
    Operator,
    apply_operator,
    draw_operands,
    draw_operands_with_focus,
    numeric_distractors,
)
from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item

# 3 wrong options + the correct one — enough to require actually computing
# the answer rather than pattern-matching, without cluttering a fast-paced
# screen with too many moving targets at once (PRD: kid-facing, short
# sessions, large tap targets).
_OPTION_COUNT = 4


class Tier(NamedTuple):
    """One difficulty rung. `operand_max` is the primary axis (PRD §11: must
    be non-decreasing with level); `approach_ms` — how long a kid has before
    time runs out — is the second, and must be non-increasing with level
    (faster is harder)."""

    max_level: int
    operand_max: int
    operations: tuple[Operator, ...]
    approach_ms: int


# Explicit and monotonic by construction: operand_max non-decreasing,
# approach_ms non-increasing, mirroring equation_builder's `_TIERS`.
_TIERS: list[Tier] = [
    Tier(max_level=2, operand_max=5, operations=("+",), approach_ms=9000),
    Tier(max_level=4, operand_max=10, operations=("+", "-"), approach_ms=7500),
    Tier(max_level=7, operand_max=12, operations=("+", "-"), approach_ms=6000),
    Tier(max_level=10, operand_max=12, operations=ALL_OPERATORS, approach_ms=4500),
]


def _tier_for_level(level: int) -> Tier:
    for tier in _TIERS:
        if level <= tier.max_level:
            return tier
    return _TIERS[-1]


class FactFluencyGame(GameModule):
    metadata = GameMetadata(
        id="fact_fluency",
        title="Equation Outbreak",
        tagline="Solve the facts. Stop the horde.",
        skill_ids=["arithmetic_fluency"],
        min_age=8,
        max_age=12,
        icon="\U0001f4a5",
        max_level=10,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        tier = _tier_for_level(level)

        # Facts are generated, not drawn from a fixed bank, so a handful of
        # retries is enough to dodge a same-session repeat — same reasoning
        # as equation_builder's identical loop.
        for _ in range(10):
            operator = rng.choice(tier.operations)
            left, right = draw_operands(operator, tier.operand_max, rng)
            answer = apply_operator(operator, left, right)
            if self._fact_key(left, operator, right, answer) not in exclude:
                break

        return self._build_item(
            level=level, operator=operator, left=left, right=right, answer=answer, approach_ms=tier.approach_ms, rng=rng, tag=f"L{level}"
        )

    def supports_practice_config(self) -> bool:
        return True

    def generate_item_from_practice_config(
        self,
        *,
        difficulty: int,
        operations: list[str],
        focus_numbers: dict[str, list[int]],
        rng: Random,
        exclude: frozenset[str] = frozenset(),
    ) -> Item:
        tier = _tier_for_level(difficulty)
        # Guards against an empty/invalid `operations` list (shouldn't happen —
        # the API layer validates non-empty on write — but this keeps the
        # generator itself never able to crash on bad stored data).
        allowed = tuple(op for op in operations if op in ALL_OPERATORS) or tier.operations

        for _ in range(10):
            operator = rng.choice(allowed)
            focus = focus_numbers.get(operator)
            left, right = draw_operands_with_focus(operator, tier.operand_max, rng, focus)
            answer = apply_operator(operator, left, right)
            if self._fact_key(left, operator, right, answer) not in exclude:
                break

        return self._build_item(
            level=difficulty,
            operator=operator,
            left=left,
            right=right,
            answer=answer,
            approach_ms=tier.approach_ms,
            rng=rng,
            tag=f"P{difficulty}",
        )

    def _build_item(
        self, *, level: int, operator: Operator, left: int, right: int, answer: int, approach_ms: int, rng: Random, tag: str
    ) -> Item:
        distractors = numeric_distractors(answer, _OPTION_COUNT - 1, rng, floor=0)
        options = [answer] + distractors
        rng.shuffle(options)

        item_id = f"{self.metadata.id}-{tag}-{rng.getrandbits(32):08x}"
        return Item(
            item_id=item_id,
            game_id=self.metadata.id,
            level=level,
            payload={
                "left": left,
                "operator": operator,
                "right": right,
                "answer": answer,
                "options": options,
                "approach_ms": approach_ms,
            },
        )

    def _fact_key(self, left: int, operator: Operator, right: int, answer: int) -> str:
        return f"{left}{operator}{right}={answer}"

    def repeat_key(self, item_payload: dict[str, Any]) -> Optional[str]:
        return self._fact_key(
            item_payload.get("left"),
            item_payload.get("operator"),
            item_payload.get("right"),
            item_payload.get("answer"),
        )


register(FactFluencyGame())
