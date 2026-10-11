"""Pure play rules around the engine: turning stored attempts into Loop A's window,
the per-game Loop A tuning, the no-repeat keys and confidence-item flag derived from
the event log, and the shapes of the records and events play writes."""

from collections.abc import Mapping, Sequence
from datetime import datetime

from pydantic import BaseModel, Field

from app.play.games.game_module_reducers_pure import GameModule
from app.play.loop_a_reducers_pure import LevelDecision, LoopAConfig, WindowAttempt
from app.play.play_schemas_pure import Attempt, AttemptCreate

ITEM_SHOWN = "item_shown"
ATTEMPT = "attempt"
DIFFICULTY_CHANGED = "difficulty_changed"
RATING_GIVEN = "rating_given"
VERIFICATION_COMPLETED = "verification_completed"


class _ShownItem(BaseModel):
    """The part of an `item_shown` event payload the no-repeat rule reads."""

    payload: dict[str, object] = Field(default_factory=dict)


def age_of(birth_year: int, current_year: int) -> int:
    """Approximate current age, derived rather than stored so it never goes stale."""
    return current_year - birth_year


def loop_config_for(game_id: str) -> LoopAConfig | None:
    """Fact Fluency's speed rounds promote on a shorter, faster window; every other
    game uses the defaults (None)."""
    if game_id != "fact_fluency":
        return None
    return LoopAConfig(
        window_size=3,
        rapid_promotion_window_size=3,
        rapid_promotion_time_ms=6000,
        promote_accuracy=0.67,
        at_level_probability=0.9,
        below_level_probability=0.1,
    )


def window_of(attempts: Sequence[Attempt]) -> list[WindowAttempt]:
    """Engine correctness signal derived from the telemetry core (PRD §5.3). Score-only
    attempts (writing) are out of Loop A's scope, so they count as not-correct rather
    than guessing a score threshold."""
    return [WindowAttempt(correct=bool(a.correct), hints_used=a.hints_used, time_ms=a.time_ms) for a in attempts]


def shown_repeat_keys(game: GameModule, shown_payloads: Sequence[Mapping[str, object]]) -> frozenset[str]:
    """No-repeat-within-a-session, derived from the session's `item_shown` events rather
    than new mutable state. Each event payload is `{**item, "pacing": ...}`, so the
    item's own payload (where `repeat_key` looks) is one level deeper."""
    keys = (game.repeat_key(_ShownItem.model_validate(event).payload) for event in shown_payloads)
    return frozenset(key for key in keys if key is not None)


def pending_confidence_item(latest: tuple[str, Mapping[str, object]] | None) -> bool:
    """A confidence item is due when the most recent of (difficulty_changed, item_shown)
    is a difficulty change that asked for one. It self-expires the first time an item is
    actually shown (PRD §5.3's append-only-log philosophy)."""
    if latest is None or latest[0] != DIFFICULTY_CHANGED:
        return False
    return bool(latest[1].get("needs_confidence_item"))


def attempt_record(payload: AttemptCreate, *, level: int, now: datetime) -> Attempt:
    return Attempt(
        item_id=payload.item_id,
        profile_id=payload.profile_id,
        game_id=payload.game_id,
        variant_id=payload.variant_id,
        session_id=payload.session_id,
        level=level,
        correct=payload.telemetry.correct,
        score=payload.telemetry.score,
        hints_used=payload.telemetry.hints_used,
        time_ms=payload.telemetry.time_ms,
        details=dict(payload.details),
        created_at=now,
    )


def attempt_event(attempt: Attempt, attempt_id: int) -> dict[str, object]:
    return {
        "attempt_id": attempt_id,
        "item_id": attempt.item_id,
        "level": attempt.level,
        "correct": attempt.correct,
        "score": attempt.score,
        "hints_used": attempt.hints_used,
        "time_ms": attempt.time_ms,
    }


def difficulty_changed_event(from_level: int, decision: LevelDecision) -> dict[str, object]:
    return {
        "from": from_level,
        "to": decision.level,
        "reason": decision.reason,
        "needs_confidence_item": decision.needs_confidence_item,
        "show_encouragement": decision.show_encouragement,
    }
