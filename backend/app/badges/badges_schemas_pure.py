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
from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class BadgeCriteria(BaseModel):
    """What earns a badge. Stored as JSON on the badge row."""

    model_config = ConfigDict(frozen=True)

    # pieces_created | attempts_correct | fast_correct_attempts | correct_streak |
    # attempts_total | all_other_badges. Anything else is never met.
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


@dataclass(frozen=True)
class SeedBadge:
    key: str
    name: str
    description: str
    criteria: BadgeCriteria


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
