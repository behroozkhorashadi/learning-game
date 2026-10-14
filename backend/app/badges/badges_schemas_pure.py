"""Badges and the profile-stats read model — HANDOFF.md §4.

Badges are fixed, seeded content (`SEED_BADGES`; there's no admin UI to define new
ones), awarded by evaluating each badge's criteria against the profile's history. The
streaks and totals on the Accomplishments screen are not stored: `ProfileStats` is
derived live from the Rating/Attempt/Piece/Event history, so there's nothing to keep
in sync when new activity happens.

`BadgeStatus` and `ProfileStats` are wire shapes (`make check-api`) and keep their
docstrings verbatim.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Tier = Literal["bronze", "silver", "gold", "legend"]
Category = Literal["streaks", "days", "time", "rounds", "accuracy", "speed", "games", "explorer", "creator", "legend"]
ArtStatus = Literal["none", "pending", "ready", "failed"]


class BadgeStatus(BaseModel):
    """Response shape for GET /api/profiles/{profile_id}/badges — a Badge
    joined with whether (and when) this profile earned it."""

    model_config = ConfigDict(frozen=True)

    key: str
    name: str
    description: str
    art_url: str
    earned: bool
    awarded_at: datetime | None = None
    category: Category
    tier: Tier
    # Why they got it, said to the kid ("You played 3 days in a row!"). None until earned.
    earned_reason: str | None = None
    # How far along, for count-based badges: progress toward goal. Both None otherwise.
    # Earned badges keep counting, so this can pass the goal ("your best: 47").
    progress: int | None = None
    goal: int | None = None
    # The game played just before the award, when it came from a game's answers.
    earned_in_game: str | None = None
    # The profile's own AI-painted art for this badge: none (not asked for, or awarded
    # before personal art existed), pending, ready (see personal_art_url), or failed.
    art_status: ArtStatus
    personal_art_url: str | None = None
    # Whether the kid has seen this award's celebration. Awards from before
    # celebrations existed count as celebrated.
    celebrated: bool


class DayActivity(BaseModel):
    """One local calendar day the profile played."""

    model_config = ConfigDict(frozen=True)

    day: date
    # Active minutes: time between consecutive events, ignoring breaks over five minutes.
    minutes: int
    rounds: int
    correct: int
    games: tuple[str, ...]


class ProfileStats(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_stars: int
    day_streak: int
    minutes_this_week: int
    most_played_game: str | None = None
    avg_rating: float | None = None
    last_session_at: datetime | None = None
    # Percentage-point change in this month's correct-attempt rate vs. last month's. None
    # when there isn't a full prior month of attempts to compare against, rather than
    # fabricating a number.
    progress_delta_pct: int | None = None
    longest_streak: int
    total_minutes: int
    # The days played in the last six weeks, newest first, for the streak calendar.
    recent_days: tuple[DayActivity, ...]


class BadgeCriteria(BaseModel):
    """What earns a badge. Stored as JSON on the badge row."""

    model_config = ConfigDict(frozen=True)

    # pieces_created | attempts_correct | fast_correct_attempts | correct_streak |
    # attempts_total | day_streak | active_days | minutes_played | games_tried |
    # all_other_badges. Anything else is never met.
    type: str
    count: int = 0
    game_id: str | None = None
    max_time_ms: int = 0


class Badge(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int
    key: str
    name: str
    description: str
    art_url: str
    criteria: BadgeCriteria


class BadgeAward(BaseModel):
    model_config = ConfigDict(frozen=True)

    badge_id: int
    awarded_at: datetime


class AwardDetail(BaseModel):
    """What happened after an award: its personal art and whether it was celebrated.
    Kept beside `badgeaward` (not in it) so existing databases need no migration."""

    model_config = ConfigDict(frozen=True)

    badge_id: int
    art_status: ArtStatus
    art_url: str | None = None
    celebrated: bool


@dataclass(frozen=True)
class SeedBadge:
    key: str
    name: str
    tier: Tier
    category: Category
    # How to earn it, said to the kid ("Play 3 days in a row").
    description: str
    # Why they got it, once they have ("You played 3 days in a row!").
    earned_text: str
    criteria: BadgeCriteria
    # What the personal art shows, before it's personalized ("a crackling campfire").
    art_theme: str


@dataclass(frozen=True)
class ArtRequest:
    """Everything that goes into one profile's painting of one badge."""

    badge_name: str
    tier: Tier
    art_theme: str
    favorite_game: str | None
    mascot: str | None


@dataclass(frozen=True)
class BadgeArtImage:
    content: bytes
    content_type: str


@dataclass(frozen=True)
class ActivityAttempt:
    """What badges and stats read from an attempt."""

    game_id: str
    correct: bool | None
    time_ms: int
    created_at: datetime


@dataclass(frozen=True)
class Activity:
    """A profile's history, as badges and stats need it. Attempts are oldest first."""

    attempts: tuple[ActivityAttempt, ...]
    piece_game_ids: tuple[str, ...]
    rating_values: tuple[int, ...]
    event_timestamps: tuple[datetime, ...]
