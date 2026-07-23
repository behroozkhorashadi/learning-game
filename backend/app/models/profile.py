"""Player Profile and per-skill state — PRD §4, §8.

Age is stored as a birth year rather than a named band: bands read as ambiguous
buckets, a birth year is a concrete fact the age can always be derived from.
"""

from datetime import date, datetime
from typing import Optional

from app.util import utcnow
from sqlmodel import Field, SQLModel, UniqueConstraint


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
