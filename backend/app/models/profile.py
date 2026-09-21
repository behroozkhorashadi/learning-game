"""Player Profile and per-skill state — PRD §4, §8.

Age is stored as a birth year rather than a named band: bands read as ambiguous
buckets, a birth year is a concrete fact the age can always be derived from.
"""

from datetime import date, datetime
from typing import Optional

from app.util import utcnow
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, UniqueConstraint

# Generic avatar keys the create-profile screen offers — none has real art yet,
# so picking one of these falls back to the profile's initial letter via
# `ProfileAvatar`'s existing onError handling. (A local dev machine may seed an
# extra profile with a real kid's photo as its avatar — see
# LOCAL_SEED_PROFILE_* in backend/.env.example — but that key isn't part of
# this list since it's not reusable art.) Shared with the frontend's
# `CreateProfile.tsx`, which hardcodes the same list rather than round-tripping
# it through an API call.
AVATAR_OPTIONS = ["fox", "owl", "bear", "cat", "panda", "rabbit"]

# Sanity bounds on a new profile's age, not a product requirement — just wide
# enough to catch an obvious typo (a future date, or a birth year that'd make
# the player an infant or an adult) without guessing at a "real" min/max.
MIN_AGE = 3
MAX_AGE = 14


class ProfileCreate(BaseModel):
    """Inbound POST body for /api/profiles. Not a table — `Profile` is the
    persisted shape."""

    name: str
    avatar: str
    birth_year: int
    reading_support: bool = False


class ProfileUpdate(BaseModel):
    """Inbound PATCH body for /api/profiles/{profile_id} (admin-only — see
    `app/admin_auth.py`). All fields optional so a caller can send just the
    ones changing, same pattern as `PieceUpdate`."""

    name: Optional[str] = None
    avatar: Optional[str] = None
    birth_year: Optional[int] = None
    reading_support: Optional[bool] = None


class Profile(SQLModel, table=True):
    """One per kid. `reading_support` is an independent per-profile flag, not an
    age rule — PRD §8 (our fluent-reading 6yo has it off)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    avatar: str
    birth_year: int
    reading_support: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)

    @property
    def age(self) -> int:
        """Approximate current age, derived rather than stored so it never goes stale."""
        return date.today().year - self.birth_year


class SkillState(SQLModel, table=True):
    """Per-(profile, skill) mastery rollup. Distinct from the per-(profile, game)
    `Level` in game.py: this is the coarser, skill-level summary the mastery
    signal (PRD §5.1) will eventually roll up into. No behavior writes to it yet.
    """

    __table_args__ = (UniqueConstraint("profile_id", "skill_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    skill_id: str = Field(foreign_key="skill.id")
    mastery_level: int = Field(default=1)
