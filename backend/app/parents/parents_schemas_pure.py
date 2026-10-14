"""Parent accounts and the progress report a parent reads about each linked kid.

A parent is a grown-up's login, not a player: it has a name and a required password,
never plays, and sees the kids whose profile links to it (the link lives on the kid's
profile). The report is derived live from the kid's history every time it's read, so
nothing here has to be kept in sync as the kid plays.

The request/response models are wire shapes (`make check-api`). The records are what
the repository stores; `KidHistory` and friends are what assembly hands in from the
play, events, badges, and pathfinder features.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

MIN_PASSWORD_LENGTH = 4
MAX_PASSWORD_LENGTH = 128
MAX_NAME_LENGTH = 40

Tone = Literal["celebrate", "attention", "info"]
Area = Literal["math", "reading", "puzzles", "writing", "other"]
SkillStatus = Literal["strong", "steady", "needs_work", "new"]


class ParentCreate(BaseModel):
    """Inbound POST body for /api/parents. A parent always has a password: it
    guards the kids' progress reports."""

    model_config = ConfigDict(frozen=True)

    name: str
    password: str


class ParentRead(BaseModel):
    """A parent account as GET /api/parents lists it."""

    model_config = ConfigDict(frozen=True)

    id: int
    name: str
    created_at: datetime


class ParentUnlockRequest(BaseModel):
    """Inbound POST body for /api/parents/{parent_id}/unlock: the parent's own
    password, or the admin password as an override."""

    model_config = ConfigDict(frozen=True)

    password: str


class ParentRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    name: str
    created_at: datetime


class NewParent(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str
    created_at: datetime


# --- The report ---


class PeriodTotals(BaseModel):
    """What a kid did in one stretch of days."""

    model_config = ConfigDict(frozen=True)

    # Active minutes: time between consecutive actions, leaving out breaks over five minutes.
    minutes: int
    active_days: int
    # Separate sittings: runs of play with no break longer than ten minutes.
    sittings: int
    problems: int
    correct: int
    # Right answers out of answers given, 0-100. None with no answers.
    accuracy_pct: int | None
    # Right on the first try (no wrong taps or shots first), 0-100.
    first_try_pct: int | None
    avg_sitting_minutes: int | None
    # Median time to a right answer.
    median_answer_ms: int | None


class DayPoint(BaseModel):
    """One local calendar day of the period (days without play included, as zeros)."""

    model_config = ConfigDict(frozen=True)

    day: date
    minutes: int
    problems: int
    correct: int
    # Active minutes per game id, for a stacked bar.
    game_minutes: dict[str, int]


class HourCell(BaseModel):
    """Minutes played in one weekday/hour slot over the period (local time)."""

    model_config = ConfigDict(frozen=True)

    # 0 = Monday.
    weekday: int
    hour: int
    minutes: int


class LevelPoint(BaseModel):
    model_config = ConfigDict(frozen=True)

    at: datetime
    level: int


class GameStat(BaseModel):
    """One game the kid played in the period."""

    model_config = ConfigDict(frozen=True)

    game_id: str
    title: str
    icon: str
    area: Area
    minutes: int
    problems: int
    accuracy_pct: int | None
    first_try_pct: int | None
    median_answer_ms: int | None
    # The adaptive difficulty: where they are now, out of the game's top level.
    level: int | None
    max_level: int | None
    # Levels moved this period (negative when the game eased off).
    levels_gained: int
    # The level at the start of the period, then every change in it.
    level_history: list[LevelPoint]
    last_played_at: datetime | None
    # Their own 1-5 rating of the game, averaged. None if never rated.
    rating: float | None
    # A game-specific line ("12 maps solved"), when it has one.
    note: str | None


class SkillStat(BaseModel):
    """One skill across every game that practices it (multiplication, 2-syllable
    words, ...), with the period before for comparison."""

    model_config = ConfigDict(frozen=True)

    key: str
    label: str
    area: Area
    problems: int
    accuracy_pct: int | None
    first_try_pct: int | None
    median_answer_ms: int | None
    previous_first_try_pct: int | None
    previous_median_answer_ms: int | None
    status: SkillStatus


class FactCell(BaseModel):
    """How one arithmetic fact went in the period, for the facts grid."""

    model_config = ConfigDict(frozen=True)

    operator: str
    left: int
    right: int
    attempts: int
    first_try: int


class TroubleSpot(BaseModel):
    """A problem the kid keeps missing."""

    model_config = ConfigDict(frozen=True)

    game_id: str
    game_title: str
    skill: str
    # As the kid saw it ("7 × ? = 56", "rabbit").
    prompt: str
    # The right answer ("8", "rab·bit").
    answer: str
    attempts: int
    misses: int
    last_seen_at: datetime
    # What they put instead, most recent first, when the game records it.
    wrong_answers: list[str]


class WeekPoint(BaseModel):
    """One week (Monday start) of the last twelve, for the progress lines."""

    model_config = ConfigDict(frozen=True)

    week_start: date
    minutes: int
    problems: int
    math_first_try_pct: int | None
    reading_first_try_pct: int | None
    math_median_answer_ms: int | None


class Insight(BaseModel):
    """One plain-language finding: a win, something to keep an eye on, or a note."""

    model_config = ConfigDict(frozen=True)

    tone: Tone
    title: str
    detail: str
    skill: str | None = None
    game_id: str | None = None


class BadgeEarned(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    tier: str
    awarded_at: datetime


class KidReport(BaseModel):
    """Response shape for GET /api/parents/{parent_id}/kids/{profile_id}/report."""

    model_config = ConfigDict(frozen=True)

    profile_id: int
    name: str
    avatar: str
    age: int
    range_days: int
    today: date
    totals: PeriodTotals
    # The same number of days just before, for comparison.
    previous: PeriodTotals
    day_streak: int
    longest_streak: int
    last_played_at: datetime | None
    daily: list[DayPoint]
    when: list[HourCell]
    games: list[GameStat]
    skills: list[SkillStat]
    fact_cells: list[FactCell]
    trouble_spots: list[TroubleSpot]
    weekly: list[WeekPoint]
    insights: list[Insight]
    badges: list[BadgeEarned]


class KidSummary(BaseModel):
    """One kid on a parent's family overview: the last seven days at a glance."""

    model_config = ConfigDict(frozen=True)

    profile_id: int
    name: str
    avatar: str
    age: int
    last_played_at: datetime | None
    minutes_7d: int
    active_days_7d: int
    problems_7d: int
    first_try_pct_7d: int | None
    day_streak: int
    # Minutes per day for the last seven days, oldest first (a sparkline).
    daily_minutes_7d: list[int]
    attention_count: int
    # The most important finding, if any.
    headline: Insight | None


# --- What assembly hands in ---


@dataclass(frozen=True)
class Kid:
    profile_id: int
    name: str
    avatar: str
    birth_year: int


@dataclass(frozen=True)
class GameInfo:
    game_id: str
    title: str
    icon: str
    max_level: int
    skill_ids: tuple[str, ...]


@dataclass(frozen=True)
class HistoryAttempt:
    game_id: str
    item_id: str
    level: int
    correct: bool | None
    hints_used: int
    time_ms: int
    details: Mapping[str, object]
    created_at: datetime


@dataclass(frozen=True)
class LevelChange:
    game_id: str
    at: datetime
    before: int
    after: int


@dataclass(frozen=True)
class KidHistory:
    """Everything the report reads, oldest first."""

    attempts: tuple[HistoryAttempt, ...]
    # The `item_shown` event payloads: what each attempt (by item id) was asked.
    shown_items: tuple[Mapping[str, object], ...]
    # Every moment the kid did something in a game: (when, game id).
    actions: tuple[tuple[datetime, str], ...]
    level_changes: tuple[LevelChange, ...]
    ratings: tuple[tuple[str, int], ...]
    badges: tuple[BadgeEarned, ...]
    pathfinder_completions: tuple[datetime, ...]
