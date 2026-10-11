"""Pure badge and stats rules: the seeded badges, whether a badge's criteria are met by a
profile's history, and the live-derived stats. "Today" arrives as an argument."""

from collections import Counter
from collections.abc import Callable, Sequence
from datetime import date, datetime, timedelta

from app.badges.badges_schemas_pure import Activity, ActivityAttempt, Badge, BadgeCriteria, ProfileStats, SeedBadge

SEED_BADGES: tuple[SeedBadge, ...] = (
    SeedBadge(
        "word-wizard",
        "Word Wizard",
        "Wrote and finished your first story",
        BadgeCriteria(type="pieces_created", count=1),
    ),
    SeedBadge(
        "sound-master",
        "Sound Master",
        "20 correct answers in Syllable Builder",
        BadgeCriteria(type="attempts_correct", count=20, game_id="syllable_builder"),
    ),
    SeedBadge(
        "quick-builder",
        "Quick Builder",
        "5 correct answers in under 4 seconds",
        BadgeCriteria(type="fast_correct_attempts", count=5, max_time_ms=4000),
    ),
    SeedBadge(
        "pattern-pro", "Pattern Pro", "10 correct answers in a row", BadgeCriteria(type="correct_streak", count=10)
    ),
    SeedBadge("speed-demon", "Speed Demon", "Played 50 rounds", BadgeCriteria(type="attempts_total", count=50)),
    # Must stay last: it depends on every other badge already being evaluated in the same pass.
    SeedBadge("champion", "Champion", "Earned every other badge", BadgeCriteria(type="all_other_badges")),
)


def art_url(key: str) -> str:
    return f"/images/achievements/{key}.png"


def criteria_json(criteria: BadgeCriteria) -> dict[str, object]:
    """As stored on the badge row: only the keys a criterion uses."""
    stored: dict[str, object] = {"type": criteria.type}
    stored.update(criteria.model_dump(exclude_defaults=True, exclude={"type"}))
    return stored


def longest_correct_streak(attempts: Sequence[ActivityAttempt]) -> int:
    best = current = 0
    for attempt in attempts:
        current = current + 1 if attempt.correct else 0
        best = max(best, current)
    return best


def progress_toward(criteria: BadgeCriteria, activity: Activity) -> int | None:
    """How far a count-based criterion has got (None for one that isn't count-based)."""
    attempts = activity.attempts
    if criteria.type == "pieces_created":
        return len(activity.piece_game_ids)
    if criteria.type == "attempts_correct":
        return sum(1 for a in attempts if a.correct and criteria.game_id in (None, a.game_id))
    if criteria.type == "fast_correct_attempts":
        return sum(1 for a in attempts if a.correct and a.time_ms <= criteria.max_time_ms)
    if criteria.type == "correct_streak":
        return longest_correct_streak(attempts)
    if criteria.type == "attempts_total":
        return len(attempts)
    return None


def criterion_met(badge: Badge, activity: Activity, *, awarded: set[int], all_badge_ids: set[int]) -> bool:
    """Unknown criterion types are never met."""
    if badge.criteria.type == "all_other_badges":
        return awarded >= (all_badge_ids - {badge.id})
    progress = progress_toward(badge.criteria, activity)
    return progress is not None and progress >= badge.criteria.count


def day_streak(dates: set[date]) -> int:
    """Consecutive active days ending on the most recent one."""
    if not dates:
        return 0
    streak = 0
    day = max(dates)
    while day in dates:
        streak += 1
        day -= timedelta(days=1)
    return streak


def progress_delta_pct(attempts: Sequence[ActivityAttempt], today: date) -> int | None:
    """Percentage-point change in correct-rate between this calendar month and last.
    None (not 0) when either month has no scored attempts to compare."""
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


def profile_stats(activity: Activity, *, today: date, game_title: Callable[[str], str | None]) -> ProfileStats:
    ratings = activity.rating_values
    week_start = today - timedelta(days=today.weekday())
    game_counts = Counter(a.game_id for a in activity.attempts) + Counter(activity.piece_game_ids)
    most_played = None
    if game_counts:
        game_id = game_counts.most_common(1)[0][0]
        most_played = game_title(game_id) or game_id
    last_session: datetime | None = max(activity.event_timestamps, default=None)
    return ProfileStats(
        total_stars=sum(ratings),
        day_streak=day_streak({t.date() for t in activity.event_timestamps}),
        minutes_this_week=round(sum(a.time_ms for a in activity.attempts if a.created_at.date() >= week_start) / 60000),
        most_played_game=most_played,
        avg_rating=round(sum(ratings) / len(ratings), 1) if ratings else None,
        last_session_at=last_session,
        progress_delta_pct=progress_delta_pct(activity.attempts, today),
    )
