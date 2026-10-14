"""Pure badge and stats rules: the seeded badges, whether a badge's criteria are met by a
profile's history, the live-derived stats, and the prompt for a badge's personal art.
"Today" and the local calendar (`day_of`) arrive as arguments."""

from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from itertools import pairwise

from app.badges.badges_schemas_pure import (
    Activity,
    ActivityAttempt,
    ArtRequest,
    AwardDetail,
    Badge,
    BadgeAward,
    BadgeCriteria,
    BadgeStatus,
    DayActivity,
    ProfileStats,
    SeedBadge,
)

DayOf = Callable[[datetime], date]

# An event more than this long after the one before it starts a new stretch of play; the
# gap between them (a snack, the tab left open) isn't counted as time played.
ACTIVE_GAP = timedelta(minutes=5)
# How far back the streak calendar looks.
RECENT_DAYS = 42


# Shelf order. Existing keys keep their meaning. `description` says how to earn it.
SEED_BADGES: tuple[SeedBadge, ...] = (
    # Streaks: days in a row.
    SeedBadge(
        key="streak-3",
        name="On a Roll",
        tier="bronze",
        category="streaks",
        description="Play 3 days in a row",
        earned_text="You played 3 days in a row!",
        art_theme="a small crackling campfire",
        criteria=BadgeCriteria(type="day_streak", count=3),
    ),
    SeedBadge(
        key="streak-7",
        name="Week Warrior",
        tier="silver",
        category="streaks",
        description="Play 7 days in a row",
        earned_text="You played 7 days in a row: a whole week!",
        art_theme="a blazing torch with seven sparks",
        criteria=BadgeCriteria(type="day_streak", count=7),
    ),
    SeedBadge(
        key="streak-30",
        name="Unstoppable",
        tier="gold",
        category="streaks",
        description="Play 30 days in a row",
        earned_text="You played 30 days in a row. Unstoppable!",
        art_theme="a roaring phoenix made of flames",
        criteria=BadgeCriteria(type="day_streak", count=30),
    ),
    # Days: how many different days.
    SeedBadge(
        key="days-10",
        name="Regular",
        tier="bronze",
        category="days",
        description="Play on 10 different days",
        earned_text="You played on 10 different days!",
        art_theme="a cheerful calendar with a gold star",
        criteria=BadgeCriteria(type="active_days", count=10),
    ),
    SeedBadge(
        key="days-50",
        name="Dedicated",
        tier="gold",
        category="days",
        description="Play on 50 different days",
        earned_text="You played on 50 different days!",
        art_theme="a sunrise over a mountain peak",
        criteria=BadgeCriteria(type="active_days", count=50),
    ),
    # Time.
    SeedBadge(
        key="minutes-60",
        name="Hour of Power",
        tier="bronze",
        category="time",
        description="Play for 1 hour in total",
        earned_text="You played for a whole hour!",
        art_theme="a glowing hourglass",
        criteria=BadgeCriteria(type="minutes_played", count=60),
    ),
    SeedBadge(
        key="minutes-600",
        name="Ten-Hour Titan",
        tier="gold",
        category="time",
        description="Play for 10 hours in total",
        earned_text="You played for 10 whole hours!",
        art_theme="a giant golden clock tower",
        criteria=BadgeCriteria(type="minutes_played", count=600),
    ),
    # Rounds answered.
    SeedBadge(
        key="speed-demon",
        name="Speed Demon",
        tier="bronze",
        category="rounds",
        description="Play 50 rounds",
        earned_text="You played 50 rounds!",
        art_theme="a racing comet",
        criteria=BadgeCriteria(type="attempts_total", count=50),
    ),
    SeedBadge(
        key="rounds-250",
        name="Marathoner",
        tier="silver",
        category="rounds",
        description="Play 250 rounds",
        earned_text="You played 250 rounds!",
        art_theme="running sneakers with wings",
        criteria=BadgeCriteria(type="attempts_total", count=250),
    ),
    SeedBadge(
        key="rounds-1000",
        name="Thousand Club",
        tier="gold",
        category="rounds",
        description="Play 1,000 rounds",
        earned_text="You played 1,000 rounds!",
        art_theme="a treasure chest overflowing with gems",
        criteria=BadgeCriteria(type="attempts_total", count=1000),
    ),
    # Accuracy: right answers in a row.
    SeedBadge(
        key="pattern-pro",
        name="Pattern Pro",
        tier="bronze",
        category="accuracy",
        description="Get 10 answers right in a row",
        earned_text="You got 10 answers right in a row!",
        art_theme="a bullseye target",
        criteria=BadgeCriteria(type="correct_streak", count=10),
    ),
    SeedBadge(
        key="sharpshooter",
        name="Sharpshooter",
        tier="silver",
        category="accuracy",
        description="Get 25 answers right in a row",
        earned_text="You got 25 answers right in a row!",
        art_theme="an arrow splitting another arrow in a bullseye",
        criteria=BadgeCriteria(type="correct_streak", count=25),
    ),
    SeedBadge(
        key="perfectionist",
        name="Perfectionist",
        tier="gold",
        category="accuracy",
        description="Get 50 answers right in a row",
        earned_text="You got 50 answers right in a row. Perfect!",
        art_theme="a flawless sparkling diamond",
        criteria=BadgeCriteria(type="correct_streak", count=50),
    ),
    # Speed: right answers, fast.
    SeedBadge(
        key="quick-builder",
        name="Quick Builder",
        tier="bronze",
        category="speed",
        description="Get 5 answers right in under 4 seconds each",
        earned_text="You got 5 answers right in under 4 seconds each!",
        art_theme="a lightning bolt over building blocks",
        criteria=BadgeCriteria(type="fast_correct_attempts", count=5, max_time_ms=4000),
    ),
    SeedBadge(
        key="lightning-brain",
        name="Lightning Brain",
        tier="silver",
        category="speed",
        description="Get 50 answers right in under 3 seconds each",
        earned_text="You got 50 answers right in under 3 seconds each!",
        art_theme="a brain crackling with lightning",
        criteria=BadgeCriteria(type="fast_correct_attempts", count=50, max_time_ms=3000),
    ),
    SeedBadge(
        key="the-flash",
        name="Faster Than Light",
        tier="gold",
        category="speed",
        description="Get 200 answers right in under 2 seconds each",
        earned_text="You got 200 answers right in under 2 seconds each!",
        art_theme="a rocket streaking past stars",
        criteria=BadgeCriteria(type="fast_correct_attempts", count=200, max_time_ms=2000),
    ),
    # Games.
    SeedBadge(
        key="sound-master",
        name="Sound Master",
        tier="silver",
        category="games",
        description="Get 20 answers right in Syllable Builder",
        earned_text="You got 20 answers right in Syllable Builder!",
        art_theme="musical notes bursting from a megaphone",
        criteria=BadgeCriteria(type="attempts_correct", count=20, game_id="syllable_builder"),
    ),
    SeedBadge(
        key="equation-engineer",
        name="Equation Engineer",
        tier="silver",
        category="games",
        description="Get 20 answers right in Equation Builder",
        earned_text="You got 20 answers right in Equation Builder!",
        art_theme="gears and a wrench forming a plus sign",
        criteria=BadgeCriteria(type="attempts_correct", count=20, game_id="equation_builder"),
    ),
    SeedBadge(
        key="outbreak-ace",
        name="Outbreak Ace",
        tier="silver",
        category="games",
        description="Get 100 answers right in Equation Outbreak",
        earned_text="You got 100 answers right in Equation Outbreak!",
        art_theme="a heroic blaster beside a cured green zombie",
        criteria=BadgeCriteria(type="attempts_correct", count=100, game_id="fact_fluency"),
    ),
    SeedBadge(
        key="zombie-slayer",
        name="Zombie Slayer",
        tier="silver",
        category="games",
        description="Get 100 answers right in Zombie Horde",
        earned_text="You got 100 answers right in Zombie Horde!",
        art_theme="a knight's shield facing a cartoon zombie",
        criteria=BadgeCriteria(type="attempts_correct", count=100, game_id="zombie_horde"),
    ),
    SeedBadge(
        key="horde-legend",
        name="Horde Legend",
        tier="gold",
        category="games",
        description="Get 500 answers right in Zombie Horde",
        earned_text="You got 500 answers right in Zombie Horde!",
        art_theme="a crowned hero standing on a hill above a defeated cartoon zombie horde",
        criteria=BadgeCriteria(type="attempts_correct", count=500, game_id="zombie_horde"),
    ),
    # Trying things.
    SeedBadge(
        key="explorer",
        name="Explorer",
        tier="bronze",
        category="explorer",
        description="Try 3 different games",
        earned_text="You tried 3 different games!",
        art_theme="a compass and a treasure map",
        criteria=BadgeCriteria(type="games_tried", count=3),
    ),
    SeedBadge(
        key="adventurer",
        name="Adventurer",
        tier="silver",
        category="explorer",
        description="Try 6 different games",
        earned_text="You tried 6 different games!",
        art_theme="a hot air balloon over floating islands",
        criteria=BadgeCriteria(type="games_tried", count=6),
    ),
    # Making things.
    SeedBadge(
        key="word-wizard",
        name="Word Wizard",
        tier="bronze",
        category="creator",
        description="Write and finish your first story",
        earned_text="You wrote and finished your first story!",
        art_theme="a wizard's hat and a glowing quill",
        criteria=BadgeCriteria(type="pieces_created", count=1),
    ),
    SeedBadge(
        key="storyteller",
        name="Storyteller",
        tier="silver",
        category="creator",
        description="Write and finish 5 stories",
        earned_text="You wrote and finished 5 stories!",
        art_theme="an open storybook with a dragon rising out of it",
        criteria=BadgeCriteria(type="pieces_created", count=5),
    ),
    # Evaluated after every other badge in the same pass (see `evaluation_order`).
    SeedBadge(
        key="champion",
        name="Champion",
        tier="legend",
        category="legend",
        description="Earn every other badge",
        earned_text="You earned every other badge. You're a champion!",
        art_theme="a jeweled crown on a golden trophy",
        criteria=BadgeCriteria(type="all_other_badges"),
    ),
)


def seed_for(key: str) -> SeedBadge | None:
    return next((seed for seed in SEED_BADGES if seed.key == key), None)


def shelf_position(key: str) -> int:
    """Seed order; a stored badge no longer seeded goes last."""
    return next((i for i, seed in enumerate(SEED_BADGES) if seed.key == key), len(SEED_BADGES))


def evaluation_order(badges: Sequence[Badge]) -> tuple[Badge, ...]:
    """Every badge before the ones that depend on all the others."""
    return tuple(sorted(badges, key=lambda badge: badge.criteria.type == "all_other_badges"))


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


def progress_toward(criteria: BadgeCriteria, activity: Activity, day_of: DayOf) -> int | None:
    """How far a count-based criterion has got (None for one that isn't count-based)."""
    attempts = activity.attempts
    progress: int | None = None
    match criteria.type:
        case "pieces_created":
            progress = len(activity.piece_game_ids)
        case "attempts_correct":
            progress = sum(1 for a in attempts if a.correct and criteria.game_id in (None, a.game_id))
        case "fast_correct_attempts":
            progress = sum(1 for a in attempts if a.correct and a.time_ms <= criteria.max_time_ms)
        case "correct_streak":
            progress = longest_correct_streak(attempts)
        case "attempts_total":
            progress = len(attempts)
        case "day_streak":
            progress = longest_day_streak(active_dates(activity, day_of))
        case "active_days":
            progress = len(active_dates(activity, day_of))
        case "minutes_played":
            progress = round(sum(active_minutes(activity.event_timestamps, day_of).values()))
        case "games_tried":
            progress = len({a.game_id for a in attempts} | set(activity.piece_game_ids))
        case _:
            pass
    return progress


def criterion_met(
    badge: Badge, activity: Activity, *, awarded: set[int], all_badge_ids: set[int], day_of: DayOf
) -> bool:
    """Unknown criterion types are never met."""
    if badge.criteria.type == "all_other_badges":
        return awarded >= (all_badge_ids - {badge.id})
    progress = progress_toward(badge.criteria, activity, day_of)
    return progress is not None and progress >= badge.criteria.count


def active_dates(activity: Activity, day_of: DayOf) -> set[date]:
    return {day_of(t) for t in activity.event_timestamps} | {day_of(a.created_at) for a in activity.attempts}


def longest_day_streak(dates: set[date]) -> int:
    best = 0
    for day in dates:
        if day - timedelta(days=1) in dates:
            continue  # not the start of a run
        length = 1
        while day + timedelta(days=length) in dates:
            length += 1
        best = max(best, length)
    return best


def active_minutes(timestamps: Sequence[datetime], day_of: DayOf) -> dict[date, float]:
    """Minutes played per day: the time between consecutive events on the same day,
    leaving out any gap longer than `ACTIVE_GAP`."""
    minutes: dict[date, float] = {}
    ordered = sorted(timestamps)
    for before, after in pairwise(ordered):
        day = day_of(before)
        if day == day_of(after) and after - before <= ACTIVE_GAP:
            minutes[day] = minutes.get(day, 0.0) + (after - before).total_seconds() / 60
    return minutes


def recent_days(
    activity: Activity, *, today: date, day_of: DayOf, game_title: Callable[[str], str | None]
) -> tuple[DayActivity, ...]:
    """Each day played in the last `RECENT_DAYS`, newest first: minutes, rounds, right
    answers, and the games played that day, most played first."""
    first = today - timedelta(days=RECENT_DAYS - 1)
    minutes = active_minutes(activity.event_timestamps, day_of)
    by_day: dict[date, list[ActivityAttempt]] = {}
    for attempt in activity.attempts:
        by_day.setdefault(day_of(attempt.created_at), []).append(attempt)
    days = sorted((d for d in active_dates(activity, day_of) if first <= d <= today), reverse=True)
    return tuple(
        DayActivity(
            day=day,
            minutes=round(minutes.get(day, 0.0)),
            rounds=len(by_day.get(day, [])),
            correct=sum(1 for a in by_day.get(day, []) if a.correct),
            games=tuple(
                game_title(game_id) or game_id
                for game_id, _ in Counter(a.game_id for a in by_day.get(day, [])).most_common()
            ),
        )
        for day in days
    )


def earned_in_game(attempts: Sequence[ActivityAttempt], awarded_at: datetime) -> str | None:
    """The game of the last attempt at or before the award (attempts are oldest first)."""
    at = _as_utc(awarded_at)
    game = None
    for attempt in attempts:
        if _as_utc(attempt.created_at) > at:
            break
        game = attempt.game_id
    return game


def _as_utc(moment: datetime) -> datetime:
    """Stored times come back naive (UTC); fresh ones are aware."""
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment


# Awards these come from aren't a game's answers, so they name no game.
NOT_FROM_A_GAME = frozenset({"pieces_created", "all_other_badges"})


@dataclass(frozen=True)
class Shelf:
    """What every badge on one profile's shelf is judged against."""

    activity: Activity
    awarded: frozenset[int]
    all_ids: frozenset[int]
    day_of: DayOf
    game_title: Callable[[str], str | None]


def badge_status(badge: Badge, award: BadgeAward | None, detail: AwardDetail | None, shelf: Shelf) -> BadgeStatus:
    """One badge on a profile's shelf: earned or not, how far along, why, and its art."""
    seeded = seed_for(badge.key)
    if badge.criteria.type == "all_other_badges":
        progress, goal = len(shelf.awarded - {badge.id}), len(shelf.all_ids - {badge.id})
    else:
        progress = progress_toward(badge.criteria, shelf.activity, shelf.day_of)
        goal = badge.criteria.count if progress is not None else None
    game_id = (
        earned_in_game(shelf.activity.attempts, award.awarded_at)
        if award is not None and badge.criteria.type not in NOT_FROM_A_GAME
        else None
    )
    return BadgeStatus(
        key=badge.key,
        name=badge.name,
        description=badge.description,
        art_url=badge.art_url,
        earned=award is not None,
        awarded_at=award.awarded_at if award is not None else None,
        category=seeded.category if seeded is not None else "rounds",
        tier=seeded.tier if seeded is not None else "bronze",
        earned_reason=(seeded.earned_text if seeded is not None else badge.description) if award else None,
        progress=progress,
        goal=goal,
        earned_in_game=(shelf.game_title(game_id) or game_id) if game_id is not None else None,
        # Awards from before details existed: no art yet, and no party owed.
        art_status=detail.art_status if detail is not None else "none",
        personal_art_url=detail.art_url if detail is not None else None,
        celebrated=detail.celebrated if detail is not None else True,
    )


def favorite_game(activity: Activity, game_title: Callable[[str], str | None]) -> str | None:
    counts = Counter(a.game_id for a in activity.attempts) + Counter(activity.piece_game_ids)
    if not counts:
        return None
    game_id = counts.most_common(1)[0][0]
    return game_title(game_id) or game_id


def art_request(
    badge: Badge, activity: Activity, *, game_title: Callable[[str], str | None], mascot: str | None
) -> ArtRequest:
    seeded = seed_for(badge.key)
    return ArtRequest(
        badge_name=badge.name,
        tier=seeded.tier if seeded is not None else "bronze",
        art_theme=seeded.art_theme if seeded is not None else "a shining star",
        favorite_game=favorite_game(activity, game_title),
        mascot=mascot,
    )


def badge_art_prompt(request: ArtRequest) -> str:
    """The personal art for one badge: its theme, in the kid's favorite game's world,
    with their mascot. The medal's rim is drawn around it on screen, so the picture is
    just the round scene inside. No words or letters, which image models garble."""
    finish = {
        "bronze": "warm copper tones",
        "silver": "cool silvery highlights",
        "gold": "a golden glow and sparkles",
        "legend": "a glowing rainbow of magic light",
    }[request.tier]
    parts = [
        f"Art for a collectible achievement badge called {request.badge_name!r} in a kids' learning game.",
        f"It shows {request.art_theme}, with {finish}.",
    ]
    if request.mascot is not None:
        parts.append(f"A friendly cartoon {request.mascot} mascot celebrates right beside it, fully inside the circle.")
    if request.favorite_game is not None:
        parts.append(f"Little details nod to the kid's favorite game, {request.favorite_game}.")
    parts.append(
        "Bold, bright, chunky cartoon style with thick outlines. The scene fills a circle edge to edge, "
        "everything important near the middle, with no border, rim, frame, or sticker outline (the badge's rim "
        "is added separately). No words, letters, or numbers anywhere."
    )
    return " ".join(parts)


def day_streak(dates: set[date], today: date) -> int:
    """The current run of days in a row: ending today, or yesterday (today isn't over
    yet). Zero once a day has been missed."""
    day = today if today in dates else today - timedelta(days=1)
    streak = 0
    while day in dates:
        streak += 1
        day -= timedelta(days=1)
    return streak


def progress_delta_pct(attempts: Sequence[ActivityAttempt], today: date, day_of: DayOf) -> int | None:
    """Percentage-point change in correct-rate between this calendar month and last.
    None (not 0) when either month has no scored attempts to compare."""
    this_month_start = today.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    scored = [a for a in attempts if a.correct is not None]
    this_month = [a for a in scored if day_of(a.created_at) >= this_month_start]
    last_month = [a for a in scored if last_month_start <= day_of(a.created_at) <= last_month_end]
    if not last_month or not this_month:
        return None
    this_rate = sum(1 for a in this_month if a.correct) / len(this_month)
    last_rate = sum(1 for a in last_month if a.correct) / len(last_month)
    return round((this_rate - last_rate) * 100)


def profile_stats(
    activity: Activity, *, today: date, day_of: DayOf, game_title: Callable[[str], str | None]
) -> ProfileStats:
    ratings = activity.rating_values
    week_start = today - timedelta(days=today.weekday())
    last_session: datetime | None = max(activity.event_timestamps, default=None)
    minutes = active_minutes(activity.event_timestamps, day_of)
    dates = active_dates(activity, day_of)
    return ProfileStats(
        total_stars=sum(ratings),
        day_streak=day_streak(dates, today),
        minutes_this_week=round(sum(m for day, m in minutes.items() if day >= week_start)),
        most_played_game=favorite_game(activity, game_title),
        avg_rating=round(sum(ratings) / len(ratings), 1) if ratings else None,
        last_session_at=last_session,
        progress_delta_pct=progress_delta_pct(activity.attempts, today, day_of),
        longest_streak=longest_day_streak(dates),
        total_minutes=round(sum(minutes.values())),
        recent_days=recent_days(activity, today=today, day_of=day_of, game_title=game_title),
    )
