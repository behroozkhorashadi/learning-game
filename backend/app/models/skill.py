"""Skill: a learning area a game module targets — PRD §4."""

from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class Skill(SQLModel, table=True):
    id: str = Field(primary_key=True)  # e.g. "phonics", "arithmetic_fluency"
    title: str
    description: Optional[str] = None


class SkillState(SQLModel, table=True):
    """Per-(profile, skill) mastery rollup. Distinct from the per-(profile, game)
    `Level` in game.py: this is the coarser, skill-level summary the mastery
    signal (PRD §5.1) will eventually roll up into. No behavior writes to it yet.
    """

    __table_args__ = (UniqueConstraint("profile_id", "skill_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int  # the profile table now belongs to app/profiles/ (no cross-feature FK)
    skill_id: str = Field(foreign_key="skill.id")
    mastery_level: int = Field(default=1)
