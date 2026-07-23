"""Thin wiring between the pure Loop A engine and persistence/the event log —
PRD §5.1, §6, §5.3.

Everything stateful and IO-bound (reading/writing the stored `Level`, querying
attempt history, appending events) lives here, never in `app.engine.loop_a`.

Mastery window (PRD §5.1 invariant: resets on any level change). No separate
window table is kept — an attempt already records the `level` it was played
at (`app.models.attempt.Attempt.level`), and `Level.updated_at` marks when the
current value was last set. Querying attempts at the current level with
`created_at >= Level.updated_at` *is* the reset: attempts from a previous
visit to that same level number, before the most recent change, are excluded.

Confidence-item injection after a support event (PRD §5.1) is likewise
derived from the event log rather than a mutable flag: `choose_next_item_level`
looks at the most recent `difficulty_changed` or `item_shown` event for the
(profile, game) pair. If the most recent one is a `difficulty_changed` whose
payload asks for a confidence item, and no `item_shown` has happened since,
the next item is forced below-level. This self-expires the first time an item
is actually shown, matching PRD §5.3's append-only-log philosophy.
"""

from __future__ import annotations

from random import Random
from typing import Optional

from sqlmodel import Session, select

from app.engine.level_selector import get_or_create_level
from app.engine.loop_a import (
    LevelDecision,
    LoopAConfig,
    NextItemDirective,
    WindowAttempt,
    check_frustration_guard,
    evaluate_level,
    select_next_item_level,
)
from app.events.log import append_event
from app.models.attempt import Attempt
from app.models.enums import EventType
from app.models.event import Event
from app.models.game import Level
from app.util import utcnow


def _is_correct(attempt: Attempt) -> bool:
    """Engine correctness signal derived from the telemetry core (PRD §5.3).
    Score-only attempts (writing) are out of Loop A's scope in this task, so
    they count as not-correct here rather than guessing a score threshold."""
    return attempt.correct if attempt.correct is not None else False


def _load_window(
    session: Session, level_row: Level, config: LoopAConfig
) -> list[WindowAttempt]:
    rows = session.exec(
        select(Attempt)
        .where(
            Attempt.profile_id == level_row.profile_id,
            Attempt.game_id == level_row.game_id,
            Attempt.level == level_row.value,
            Attempt.created_at >= level_row.updated_at,
        )
        .order_by(Attempt.created_at.desc())
        .limit(config.window_size)
    ).all()
    rows.reverse()
    return [WindowAttempt(correct=_is_correct(a), hints_used=a.hints_used) for a in rows]


def process_attempt(
    session: Session,
    *,
    attempt: Attempt,
    max_level: int,
    config: Optional[LoopAConfig] = None,
) -> tuple[LevelDecision, bool]:
    """Runs Loop A for one already-persisted `Attempt` — PRD §5.1.

    Checks the frustration guard every attempt, evaluates the promote/hold/
    support rules once the window is full, persists any level change, and
    appends a `difficulty_changed` event carrying the reason. Returns the
    level decision and whether the frustration guard fired, so the caller
    (an API endpoint) can surface both without re-deriving them.
    """
    config = config or LoopAConfig()
    level_row = get_or_create_level(session, attempt.profile_id, attempt.game_id)

    window = _load_window(session, level_row, config)
    hint_offered = check_frustration_guard(window)
    decision = evaluate_level(level_row.value, window, max_level, config)

    if decision.changed:
        from_level = level_row.value
        level_row.value = decision.level
        level_row.updated_at = utcnow()
        session.add(level_row)
        session.commit()

        append_event(
            session,
            profile_id=attempt.profile_id,
            game_id=attempt.game_id,
            event_type=EventType.DIFFICULTY_CHANGED,
            payload={
                "from": from_level,
                "to": decision.level,
                "reason": decision.reason,
                "needs_confidence_item": decision.needs_confidence_item,
                "show_encouragement": decision.show_encouragement,
            },
            variant_id=attempt.variant_id,
            session_id=attempt.session_id,
        )

    return decision, hint_offered


def _pending_confidence_item(session: Session, profile_id: int, game_id: str) -> bool:
    latest = session.exec(
        select(Event)
        .where(
            Event.profile_id == profile_id,
            Event.game_id == game_id,
            Event.event_type.in_([EventType.DIFFICULTY_CHANGED, EventType.ITEM_SHOWN]),
        )
        .order_by(Event.timestamp.desc())
        .limit(1)
    ).first()
    if latest is None or latest.event_type != EventType.DIFFICULTY_CHANGED:
        return False
    return bool(latest.payload.get("needs_confidence_item"))


def choose_next_item_level(
    session: Session,
    *,
    profile_id: int,
    game_id: str,
    max_level: int,
    rng: Random,
    config: Optional[LoopAConfig] = None,
) -> NextItemDirective:
    """Picks the next item's target difficulty — PRD §5.1 session pacing.
    Called before `generate_item`; the caller passes `.level` from the result
    straight into the game module."""
    config = config or LoopAConfig()
    level_row = get_or_create_level(session, profile_id, game_id)
    force_confidence = _pending_confidence_item(session, profile_id, game_id)
    return select_next_item_level(
        level_row.value,
        max_level,
        rng,
        config,
        force_confidence_item=force_confidence,
    )
