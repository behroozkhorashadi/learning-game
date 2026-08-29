"""Badge seeding, awarding, and the profile-stats read-model — HANDOFF.md §4.

Badges are fixed content (`SEED_BADGES`) evaluated against a profile's
Attempt/Piece history; there is no admin UI to author new ones. Awarding is
idempotent — `BadgeAward` has a `(profile_id, badge_id)` unique constraint —
so `evaluate_and_award_badges` is safe to call after every Attempt/Piece
write without tracking "have we already checked this" state anywhere.

`compute_profile_stats` is the other half: everything on the Accomplishments
screen's parent view is derived live from Rating/Attempt/Event rows rather
than stored, per HANDOFF.md §4's explicit instruction that "streaks and
totals should derive from the existing Event log rather than being stored."
"""

from collections import Counter
from datetime import date, timedelta
from typing import Any, Optional

from sqlmodel import Session, select

from app.events.log import append_event
from app.games.registry import get_game
from app.models.attempt import Attempt
from app.models.badge import Badge, BadgeAward
from app.models.enums import EventType
from app.models.event import Event
from app.models.piece import Piece
from app.models.rating import Rating
from app.models.stats import ProfileStats
from app.util import utcnow

SEED_BADGES: list[dict[str, Any]] = [
    {
        "key": "word-wizard",
        "name": "Word Wizard",
        "description": "Wrote and finished your first story",
        "criteria": {"type": "pieces_created", "count": 1},
    },
    {
        "key": "sound-master",
        "name": "Sound Master",
        "description": "20 correct answers in Syllable Builder",
        "criteria": {"type": "attempts_correct", "count": 20, "game_id": "syllable_builder"},
    },
    {
        "key": "quick-builder",
        "name": "Quick Builder",
        "description": "5 correct answers in under 4 seconds",
        "criteria": {"type": "fast_correct_attempts", "count": 5, "max_time_ms": 4000},
    },
    {
        "key": "pattern-pro",
        "name": "Pattern Pro",
        "description": "10 correct answers in a row",
        "criteria": {"type": "correct_streak", "count": 10},
    },
    {
        "key": "speed-demon",
        "name": "Speed Demon",
        "description": "Played 50 rounds",
        "criteria": {"type": "attempts_total", "count": 50},
    },
    {
        # Must stay last: it depends on every other badge already being
        # evaluated in the same pass (see evaluate_and_award_badges).
        "key": "champion",
        "name": "Champion",
        "description": "Earned every other badge",
        "criteria": {"type": "all_other_badges"},
    },
]


def seed_badges(session: Session) -> None:
    existing_keys = {b.key for b in session.exec(select(Badge)).all()}
    for entry in SEED_BADGES:
        if entry["key"] in existing_keys:
            continue
        session.add(
            Badge(
                key=entry["key"],
                name=entry["name"],
                description=entry["description"],
                art_url=f"/images/achievements/{entry['key']}.png",
                criteria=entry["criteria"],
            )
        )
    session.commit()


def _longest_correct_streak(attempts: list[Attempt]) -> int:
    best = current = 0
    for attempt in attempts:
        if attempt.correct:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def _criterion_met(
    criteria: dict[str, Any],
    *,
    pieces: list[Piece],
    attempts: list[Attempt],
    awarded_badge_ids: set[int],
    all_badge_ids: set[int],
    this_badge_id: int,
) -> bool:
    kind = criteria.get("type")
    if kind == "pieces_created":
        return len(pieces) >= criteria["count"]
    if kind == "attempts_correct":
        game_id = criteria.get("game_id")
        matching = [a for a in attempts if a.correct and (game_id is None or a.game_id == game_id)]
        return len(matching) >= criteria["count"]
    if kind == "fast_correct_attempts":
        matching = [a for a in attempts if a.correct and a.time_ms <= criteria["max_time_ms"]]
        return len(matching) >= criteria["count"]
    if kind == "correct_streak":
        return _longest_correct_streak(attempts) >= criteria["count"]
    if kind == "attempts_total":
        return len(attempts) >= criteria["count"]
    if kind == "all_other_badges":
        return awarded_badge_ids >= (all_badge_ids - {this_badge_id})
    return False


def evaluate_and_award_badges(
    session: Session, *, profile_id: int, session_id: Optional[str] = None
) -> list[Badge]:
    """Checks every badge this profile hasn't earned yet and awards any whose
    criteria are now satisfied. Returns the newly-awarded badges (usually
    empty). Badges are evaluated in seed order so "champion" (earn-all-others,
    always seeded last) sees the results of this same pass."""

    badges = list(session.exec(select(Badge).order_by(Badge.id)).all())
    all_badge_ids = {b.id for b in badges}
    awarded_badge_ids = {
        a.badge_id
        for a in session.exec(select(BadgeAward).where(BadgeAward.profile_id == profile_id)).all()
    }

    pieces = list(session.exec(select(Piece).where(Piece.profile_id == profile_id)).all())
    attempts = list(
        session.exec(
            select(Attempt).where(Attempt.profile_id == profile_id).order_by(Attempt.created_at)
        ).all()
    )

    newly_awarded: list[Badge] = []
    for badge in badges:
        if badge.id in awarded_badge_ids:
            continue
        if not _criterion_met(
            badge.criteria,
            pieces=pieces,
            attempts=attempts,
            awarded_badge_ids=awarded_badge_ids,
            all_badge_ids=all_badge_ids,
            this_badge_id=badge.id,
        ):
            continue

        award = BadgeAward(profile_id=profile_id, badge_id=badge.id, session_id=session_id)
        session.add(award)
        session.commit()
        session.refresh(award)
        awarded_badge_ids.add(badge.id)
        newly_awarded.append(badge)

        append_event(
            session,
            profile_id=profile_id,
            game_id="badges",
            event_type=EventType.BADGE_AWARDED,
            payload={"badge_id": badge.id, "badge_key": badge.key},
            session_id=session_id,
        )

    return newly_awarded


def _day_streak(dates: set[date]) -> int:
    if not dates:
        return 0
    streak = 0
    day = max(dates)
    while day in dates:
        streak += 1
        day -= timedelta(days=1)
    return streak


def _start_of_week(today: date) -> date:
    return today - timedelta(days=today.weekday())


def compute_profile_stats(session: Session, profile_id: int) -> ProfileStats:
    ratings = list(session.exec(select(Rating).where(Rating.profile_id == profile_id)).all())
    attempts = list(session.exec(select(Attempt).where(Attempt.profile_id == profile_id)).all())
    pieces = list(session.exec(select(Piece).where(Piece.profile_id == profile_id)).all())
    events = list(session.exec(select(Event).where(Event.profile_id == profile_id)).all())

    total_stars = sum(r.value for r in ratings)
    avg_rating = round(sum(r.value for r in ratings) / len(ratings), 1) if ratings else None

    active_dates = {e.timestamp.date() for e in events}
    day_streak = _day_streak(active_dates)

    week_start = _start_of_week(utcnow().date())
    minutes_this_week = round(
        sum(a.time_ms for a in attempts if a.created_at.date() >= week_start) / 60000
    )

    game_counts = Counter(a.game_id for a in attempts) + Counter(p.game_id for p in pieces)
    most_played_game = None
    if game_counts:
        game_id = game_counts.most_common(1)[0][0]
        try:
            most_played_game = get_game(game_id).metadata.title
        except KeyError:
            most_played_game = game_id

    last_session_at = max((e.timestamp for e in events), default=None)

    progress_delta_pct = _progress_delta_pct(attempts)

    return ProfileStats(
        total_stars=total_stars,
        day_streak=day_streak,
        minutes_this_week=minutes_this_week,
        most_played_game=most_played_game,
        avg_rating=avg_rating,
        last_session_at=last_session_at,
        progress_delta_pct=progress_delta_pct,
    )


def _progress_delta_pct(attempts: list[Attempt]) -> Optional[int]:
    """Percentage-point change in correct-rate between this calendar month
    and last. `None` (not 0) when there's no scored history in the prior
    month to compare against."""
    today = utcnow().date()
    this_month_start = today.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    scored = [a for a in attempts if a.correct is not None]
    this_month = [a for a in scored if a.created_at.date() >= this_month_start]
    last_month = [a for a in scored if last_month_start <= a.created_at.date() <= last_month_end]

    if not last_month or not this_month:
        return None

    this_rate = sum(1 for a in this_month if a.correct) / len(this_month)
    last_rate = sum(1 for a in last_month if a.correct) / len(last_month)
    return round((this_rate - last_rate) * 100)
