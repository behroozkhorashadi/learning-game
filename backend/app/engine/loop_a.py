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

from pydantic import BaseModel, Field


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

    rapid_promotion_window_size: int = Field(default=3, ge=1)
    """Consecutive correct, hint-free attempts needed for a speed-based promotion."""

    rapid_promotion_time_ms: int | None = Field(default=None, ge=1)
    """Optional average response-time ceiling for early promotion. Disabled by default."""

    promote_window_size: int | None = Field(default=None, ge=1)
    """Attempts the promote rule looks at. None means `window_size`. Can be
    larger than `window_size` so promotion needs more evidence than support
    does — see `pace_for_age`."""

    extra_promotion_attempts_per_level_beyond_age: int = Field(default=1, ge=0)
    """Age pacing (`pace_for_age`): each level a promotion would land past the
    level typical for the kid's age adds this many attempts to both promotion
    streaks (regular and rapid)."""

    @property
    def effective_promote_window_size(self) -> int:
        return self.promote_window_size or self.window_size

    @property
    def history_size(self) -> int:
        """How many recent attempts at the current level the caller must load
        so every rule (support, promote, rapid promotion) can see its full window."""
        return max(self.window_size, self.effective_promote_window_size, self.rapid_promotion_window_size)


class WindowAttempt(BaseModel):
    """One attempt's engine-relevant signal, derived from the `TelemetryCore`
    (PRD §5.3) by the calling service. `correct` is the boolean correctness
    signal the engine's accuracy rules operate on."""

    correct: bool
    hints_used: int
    time_ms: int


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


def pace_for_age(config: LoopAConfig, current_level: int, age_level: int) -> LoopAConfig:
    """Age sets how fast a kid climbs, never how far — PRD §4 calibrates
    difficulty from age, but a hard age ceiling stalls a kid who has clearly
    mastered everything below it. `age_level` is the highest level typical for
    the kid's age (`GameModule.typical_level_for_age`). Promotions that stay
    within it use `config` unchanged. Each level a promotion would land past it
    adds `extra_promotion_attempts_per_level_beyond_age` attempts to both
    promotion streaks, so moving up past the age-typical range takes
    progressively more sustained evidence. Support (moving down) is unchanged."""
    levels_beyond = current_level + 1 - age_level
    extra = levels_beyond * config.extra_promotion_attempts_per_level_beyond_age
    if extra <= 0:
        return config
    return config.model_copy(
        update={
            "promote_window_size": config.effective_promote_window_size + extra,
            "rapid_promotion_window_size": config.rapid_promotion_window_size + extra,
        }
    )


def evaluate_level(
    current_level: int,
    window: list[WindowAttempt],
    max_level: int,
    config: LoopAConfig | None = None,
) -> LevelDecision:
    """Promote/hold/support rules — PRD §5.1.

    Evaluated only once the window is full (`len(window) >= config.window_size`);
    returns a no-op `PENDING` decision otherwise. Support and hold look at the
    last `window_size` attempts; promote looks at the last
    `effective_promote_window_size`, which may be longer (`pace_for_age`). The window is assumed to
    already hold only attempts made at `current_level` since it was last set —
    resetting it on a level change is the caller's invariant to uphold, not
    this function's (see `app.services.loop_a_service`).

    Floor and ceiling guards (PRD §5.1) are enforced here by clamping: support
    never drops below `config.min_level`, promote never exceeds `max_level`.
    If a clamp blocks the change, `changed` is False and `reset_window` is
    False, since no real level transition happened.
    """
    config = config or LoopAConfig()

    rapid_window = window[-config.rapid_promotion_window_size :]
    rapid_promotion = (
        config.rapid_promotion_time_ms is not None
        and len(rapid_window) == config.rapid_promotion_window_size
        and all(attempt.correct and attempt.hints_used == 0 for attempt in rapid_window)
        and sum(attempt.time_ms for attempt in rapid_window) / len(rapid_window)
        <= config.rapid_promotion_time_ms
    )
    if rapid_promotion:
        new_level = min(current_level + 1, max_level)
        changed = new_level != current_level
        average_ms = sum(attempt.time_ms for attempt in rapid_window) / len(rapid_window)
        return LevelDecision(
            action=LevelAction.PROMOTE,
            level=new_level,
            changed=changed,
            reason=(
                f"rapid promotion to L{new_level}: {len(rapid_window)} correct, "
                f"{average_ms:.0f}ms avg"
                if changed
                else f"held at ceiling L{current_level}: {average_ms:.0f}ms avg"
            ),
            reset_window=changed,
        )

    if len(window) < config.window_size:
        return LevelDecision(
            action=LevelAction.PENDING,
            level=current_level,
            changed=False,
            reason="window not full",
            reset_window=False,
        )

    promote_size = config.effective_promote_window_size
    if len(window) >= promote_size:
        promote_window = window[-promote_size:]
        n = len(promote_window)
        correct_count = sum(1 for a in promote_window if a.correct)
        hint_rate = sum(a.hints_used for a in promote_window) / n
        if correct_count / n >= config.promote_accuracy and hint_rate < config.hint_rate_threshold:
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

    window = window[-config.window_size :]
    n = len(window)
    correct_count = sum(1 for a in window if a.correct)
    accuracy = correct_count / n
    hint_rate = sum(a.hints_used for a in window) / n

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
