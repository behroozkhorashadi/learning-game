"""Loop A: real-time difficulty adaptation — PRD §5.1.

Pure functions only: no IO, no DB, no logging. Everything the engine needs
comes in as arguments (current level, the mastery window, config, max level,
an injected RNG); everything it decides comes out as a typed return value. The
calling service (`app.services.loop_a_service`) is responsible for reading and
writing persistence and for appending events — this module never does either.

Two decisions are kept deliberately separate (PRD §5.1, per-task constraint 2):
`evaluate_level` decides whether the level should change after an attempt;
`select_next_item_level` decides the difficulty of the next item to serve.
Neither function calls the other.
"""

from __future__ import annotations

from enum import Enum
from random import Random

from pydantic import BaseModel


class LoopAConfig(BaseModel):
    """Tunable thresholds for Loop A — PRD §5.1. One place to tune against
    real data instead of scattering literals through the logic."""

    window_size: int = 5
    """K: number of attempts at the current level that make up the mastery window."""

    promote_accuracy: float = 0.8
    """Promote requires accuracy >= this."""

    support_accuracy: float = 0.5
    """Support fires when accuracy is below this."""

    hint_rate_threshold: float = 1.0
    """Promote also requires average hints/item strictly below this."""

    at_level_probability: float = 0.8
    """Session pacing: fraction of non-stretch draws served at the current level."""

    below_level_probability: float = 0.2
    """Session pacing: fraction of non-stretch draws served one level below (spaced review)."""

    stretch_probability: float = 0.1
    """Session pacing: probability of an occasional stretch item one level above."""

    min_level: int = 1
    """Floor: level (and below-level pacing / confidence items) never goes below this."""


class WindowAttempt(BaseModel):
    """One attempt's engine-relevant signal, derived from the `TelemetryCore`
    (PRD §5.3) by the calling service. `correct` is the boolean correctness
    signal the engine's accuracy rules operate on."""

    correct: bool
    hints_used: int


class LevelAction(str, Enum):
    PROMOTE = "promote"
    HOLD = "hold"
    SUPPORT = "support"
    PENDING = "pending"


class LevelDecision(BaseModel):
    """Result of `evaluate_level`. `reason` is a first-class return value (PRD
    §5.1 observability requirement) — the caller persists it, it is never
    logged or written by the engine itself."""

    action: LevelAction
    level: int
    changed: bool
    reason: str
    reset_window: bool
    needs_confidence_item: bool = False
    show_encouragement: bool = False


class NextItemKind(str, Enum):
    AT_LEVEL = "at_level"
    BELOW_LEVEL = "below_level"
    STRETCH = "stretch"
    CONFIDENCE = "confidence"


class NextItemDirective(BaseModel):
    """Result of `select_next_item_level`. A target difficulty and a tag for
    why — never generated content. The caller passes `.level` to the game
    module's `generate_item` (PRD §6); the engine never imports a game."""

    level: int
    kind: NextItemKind


def evaluate_level(
    current_level: int,
    window: list[WindowAttempt],
    max_level: int,
    config: LoopAConfig | None = None,
) -> LevelDecision:
    """Promote/hold/support rules — PRD §5.1.

    Evaluated only once the window is full (`len(window) == config.window_size`);
    returns a no-op `PENDING` decision otherwise. The window is assumed to
    already hold only attempts made at `current_level` since it was last set —
    resetting it on a level change is the caller's invariant to uphold, not
    this function's (see `app.services.loop_a_service`).

    Floor and ceiling guards (PRD §5.1) are enforced here by clamping: support
    never drops below `config.min_level`, promote never exceeds `max_level`.
    If a clamp blocks the change, `changed` is False and `reset_window` is
    False, since no real level transition happened.
    """
    config = config or LoopAConfig()

    if len(window) < config.window_size:
        return LevelDecision(
            action=LevelAction.PENDING,
            level=current_level,
            changed=False,
            reason="window not full",
            reset_window=False,
        )

    n = len(window)
    correct_count = sum(1 for a in window if a.correct)
    accuracy = correct_count / n
    hint_rate = sum(a.hints_used for a in window) / n

    if accuracy >= config.promote_accuracy and hint_rate < config.hint_rate_threshold:
        new_level = min(current_level + 1, max_level)
        changed = new_level != current_level
        if changed:
            reason = f"promoted to L{new_level}: {correct_count}/{n} correct, {hint_rate:.1f} avg hints"
        else:
            reason = f"held at ceiling L{current_level}: {correct_count}/{n} correct, {hint_rate:.1f} avg hints"
        return LevelDecision(
            action=LevelAction.PROMOTE,
            level=new_level,
            changed=changed,
            reason=reason,
            reset_window=changed,
        )

    if accuracy < config.support_accuracy:
        new_level = max(current_level - 1, config.min_level)
        changed = new_level != current_level
        if changed:
            reason = f"support to L{new_level}: {correct_count}/{n} correct"
        else:
            reason = f"held at floor L{current_level}: {correct_count}/{n} correct"
        return LevelDecision(
            action=LevelAction.SUPPORT,
            level=new_level,
            changed=changed,
            reason=reason,
            reset_window=changed,
            needs_confidence_item=changed,
            show_encouragement=changed,
        )

    reason = f"held at L{current_level}: {correct_count}/{n} correct, {hint_rate:.1f} avg hints"
    return LevelDecision(
        action=LevelAction.HOLD,
        level=current_level,
        changed=False,
        reason=reason,
        reset_window=False,
    )


def check_frustration_guard(window: list[WindowAttempt]) -> bool:
    """Frustration guard — PRD §5.1. Checked every attempt regardless of
    window fullness: two wrong in a row triggers an immediate hint offer.
    Never changes the level; that is the whole point of keeping guards and
    rules on separate cadences (per-task constraint 4)."""
    if len(window) < 2:
        return False
    return not window[-1].correct and not window[-2].correct


def select_next_item_level(
    current_level: int,
    max_level: int,
    rng: Random,
    config: LoopAConfig | None = None,
    force_confidence_item: bool = False,
) -> NextItemDirective:
    """Session pacing for the next item's difficulty — PRD §5.1. Roughly
    80/20 at-level vs. one-below (spaced review), with an occasional stretch
    item one above to probe readiness. `rng` is injected (never module-level
    randomness) so pacing is deterministically testable under a fixed seed.

    `force_confidence_item` serves the below-level "confidence item" PRD §5.1
    mandates immediately after a support event; the caller sets it based on
    the most recent `difficulty_changed` decision, not this function.
    """
    config = config or LoopAConfig()

    if force_confidence_item:
        return NextItemDirective(
            level=max(current_level - 1, config.min_level),
            kind=NextItemKind.CONFIDENCE,
        )

    if current_level < max_level and rng.random() < config.stretch_probability:
        return NextItemDirective(level=current_level + 1, kind=NextItemKind.STRETCH)

    if rng.random() < config.below_level_probability:
        return NextItemDirective(
            level=max(current_level - 1, config.min_level),
            kind=NextItemKind.BELOW_LEVEL,
        )

    return NextItemDirective(level=current_level, kind=NextItemKind.AT_LEVEL)
