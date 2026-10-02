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

from collections.abc import Mapping, Sequence
from typing import Literal, NamedTuple, override

from app.play.games.arithmetic_reducers_pure import (
    ALL_OPERATORS,
    Fact,
    Operator,
    apply_operator,
    draw_operands,
    draw_operands_with_focus,
    draw_operator_with_ramp,
    first_unseen,
    numeric_distractors,
)
from app.play.games.game_module_reducers_pure import GameModule
from app.play.play_ports_pure import Rng
from app.play.play_schemas_pure import GameMetadata, Item

# Which term of `left operator right = answer` a kid supplies: the answer (a plain
# fact, "3 + 4 = ?") or one of the operands (solve for x: "x + 3 = 7").
Missing = Literal["answer", "left", "right"]
_FACT: tuple[Missing, ...] = ("answer",)
_SOLVE_FOR_X: tuple[Missing, ...] = ("left", "right")

# 3 wrong options + the correct one — enough to require actually computing
# the answer rather than pattern-matching, without cluttering a fast-paced
# screen with too many moving targets at once (PRD: kid-facing, short
# sessions, large tap targets).
_OPTION_COUNT = 4


class Tier(NamedTuple):
    """One difficulty rung. `operand_max` is the primary axis (PRD §11: must
    be non-decreasing with level); `approach_ms` — how long a kid has before
    time runs out — is the second, and must be non-increasing with level
    (faster is harder). `min_age` is the youngest PRD §4 persona this tier's
    operations typically suit — not a gate: a younger kid can still be
    promoted into it, just more slowly (see `typical_level_for_age`),
    mirroring `equation_builder`'s identical rule. `missing` is which term a
    kid supplies: the answer, or (the top tiers) an operand, solving for x."""

    max_level: int
    operand_max: int
    operations: tuple[Operator, ...]
    approach_ms: int
    min_age: int
    missing: tuple[Missing, ...] = _FACT


# Explicit and monotonic by construction: operand_max non-decreasing,
# approach_ms non-increasing, mirroring equation_builder's `TIERS`. `min_age`
# graduates *within* this game's own 6-12 audience rather than sitting flat at
# the game's own `min_age=6` for every tier: a fresh 6-year-old still starts on
# addition, and
# multiplication/division (the last tier) are typical from age 10, one step past
# equation_builder's introduction of it — Fact Fluency layers time pressure
# on top of the same operators, so it earns a slightly later start.
#
# The top two tiers come after ×/÷: solving for x ("x + 3 = 7", then "x × 4 =
# 12"), + and - first, then all four. Their `min_age` is past every age this
# game targets, so they're never age-typical: a brand-new profile never starts
# on them, and reaching them is earned by promotion alone.
TIERS: tuple[Tier, ...] = (
    Tier(max_level=1, operand_max=5, operations=("+",), approach_ms=9000, min_age=6),
    Tier(max_level=2, operand_max=8, operations=("+",), approach_ms=8250, min_age=6),
    Tier(max_level=3, operand_max=10, operations=("+",), approach_ms=7500, min_age=6),
    Tier(max_level=4, operand_max=10, operations=("+", "-"), approach_ms=7000, min_age=8),
    Tier(max_level=5, operand_max=12, operations=("+", "-"), approach_ms=6500, min_age=9),
    Tier(max_level=6, operand_max=12, operations=("+", "-"), approach_ms=6000, min_age=9),
    Tier(max_level=7, operand_max=12, operations=ALL_OPERATORS, approach_ms=5750, min_age=10),
    Tier(max_level=8, operand_max=12, operations=ALL_OPERATORS, approach_ms=5250, min_age=10),
    Tier(max_level=9, operand_max=12, operations=ALL_OPERATORS, approach_ms=4750, min_age=10),
    Tier(max_level=10, operand_max=12, operations=ALL_OPERATORS, approach_ms=4500, min_age=10),
    Tier(max_level=11, operand_max=12, operations=("+", "-"), approach_ms=4500, min_age=13, missing=_SOLVE_FOR_X),
    Tier(max_level=12, operand_max=12, operations=ALL_OPERATORS, approach_ms=4500, min_age=13, missing=_SOLVE_FOR_X),
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


def _band_bounds(tier_index: int) -> tuple[int, int]:
    """First and last tier index of the run of consecutive tiers that share
    `TIERS[tier_index]`'s operator set — its "operator band". The tiers are
    single-level speed/operand rungs, so the ×/÷ ramp-in and the starting
    level both reason about bands: a single rung is too short to ease a new
    operator in over, and starting "one tier short of the ceiling" by rung
    would drop a brand-new profile straight into ×/÷."""
    operations = TIERS[tier_index].operations
    first = tier_index
    while first > 0 and TIERS[first - 1].operations == operations:
        first -= 1
    last = tier_index
    while last < len(TIERS) - 1 and TIERS[last + 1].operations == operations:
        last += 1
    return first, last


def _new_operations_for_tier(tier_index: int) -> tuple[Operator, ...]:
    """Operators `TIERS[tier_index]`'s band has that the band before it
    didn't — what `draw_operator_with_ramp` eases in gradually across the
    band rather than at full weight from its first level. Empty for the
    first band (nothing to ramp against yet)."""
    first, _ = _band_bounds(tier_index)
    if first == 0:
        return ()
    previous_operations = set(TIERS[first - 1].operations)
    return tuple(op for op in TIERS[tier_index].operations if op not in previous_operations)


def _band_progress(level: int, tier_index: int) -> float:
    """How far `level` is through `TIERS[tier_index]`'s operator band — 0.0
    at the band's first level, 1.0 at its last."""
    first, last = _band_bounds(tier_index)
    start = _tier_start_level(first)
    end = TIERS[last].max_level
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
    operator band (see `_band_bounds`) just *below* the highest one this age
    has reached, mirroring
    `equation_builder`'s identical rule: deliberately one tier short of the
    age-typical level rather than landing right on it, so a kid still has to earn
    the hardest age-typical tier via a genuine promotion. Loop A's
    promote/support rules do the actual fine-tuning from there."""
    ceiling_band_first, _ = _band_bounds(_tier_index_for_level(_typical_level_for_age(age)))
    if ceiling_band_first == 0:
        return 1
    start_band_first, _ = _band_bounds(ceiling_band_first - 1)
    return _tier_start_level(start_band_first)


def _draw_missing(tier: Tier, rng: Rng) -> Missing:
    """Which term this item leaves out. A tier with one choice draws nothing, so
    the plain-fact tiers' random stream (and items) are what they always were."""
    return tier.missing[0] if len(tier.missing) == 1 else rng.choice(tier.missing)


class FactFluencyGame(GameModule):
    metadata = GameMetadata(
        id="fact_fluency",
        title="Equation Outbreak",
        tagline="Solve the facts. Stop the horde.",
        skill_ids=["arithmetic_fluency"],
        min_age=6,
        max_age=12,
        icon="\U0001f4a5",
        max_level=12,
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
        progress = _band_progress(level, tier_index)

        # Facts are generated, not drawn from a fixed bank, so a handful of
        # retries is enough to dodge a same-session repeat — same reasoning
        # as equation_builder's identical loop.
        def draw() -> Fact:
            operator = draw_operator_with_ramp(tier.operations, new_operations, progress, rng)
            left, right = draw_operands(operator, tier.operand_max, rng)
            return Fact(left, operator, right, apply_operator(operator, left, right))

        missing = _draw_missing(tier, rng)
        fact = first_unseen(draw, lambda f: self._key(f, missing), exclude)

        return self._build_item(
            fact, missing=missing, level=level, approach_ms=tier.approach_ms, rng=rng, tag=f"L{level}"
        )

    @override
    def supports_practice_config(self) -> bool:
        return True

    @override
    def generate_item_from_practice_config(
        self,
        *,
        difficulty: int,
        operations: Sequence[str],
        focus_numbers: Mapping[str, Sequence[int]],
        rng: Rng,
        exclude: frozenset[str] = frozenset(),
    ) -> Item:
        tier = tier_for_level(difficulty)
        # Guards against an empty/invalid `operations` list (shouldn't happen —
        # the API layer validates non-empty on write — but this keeps the
        # generator itself never able to crash on bad stored data).
        allowed = tuple(op for op in operations if op in ALL_OPERATORS) or tier.operations

        def draw() -> Fact:
            operator = rng.choice(allowed)
            left, right = draw_operands_with_focus(operator, tier.operand_max, rng, focus_numbers.get(operator))
            return Fact(left, operator, right, apply_operator(operator, left, right))

        missing = _draw_missing(tier, rng)
        fact = first_unseen(draw, lambda f: self._key(f, missing), exclude)

        return self._build_item(
            fact, missing=missing, level=difficulty, approach_ms=tier.approach_ms, rng=rng, tag=f"P{difficulty}"
        )

    def _build_item(self, fact: Fact, *, missing: Missing, level: int, approach_ms: int, rng: Rng, tag: str) -> Item:
        left, operator, right, answer = fact
        value = {"answer": answer, "left": left, "right": right}[missing]
        distractors = numeric_distractors(value, _OPTION_COUNT - 1, rng, floor=0)
        options = [value, *distractors]
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
                "missing": missing,
                "options": options,
                "approach_ms": approach_ms,
            },
        )

    def _fact_key(self, left: object, operator: object, right: object, answer: object, missing: object) -> str:
        # A plain fact keeps its original key, so sessions recorded before solving for x still dedupe.
        fact = f"{left}{operator}{right}={answer}"
        return fact if missing in (None, "answer") else f"{fact}|{missing}"

    def _key(self, fact: Fact, missing: Missing) -> str:
        return self._fact_key(fact.left, fact.operator, fact.right, fact.answer, missing)

    @override
    def repeat_key(self, item_payload: Mapping[str, object]) -> str | None:
        return self._fact_key(
            item_payload.get("left"),
            item_payload.get("operator"),
            item_payload.get("right"),
            item_payload.get("answer"),
            item_payload.get("missing"),
        )
