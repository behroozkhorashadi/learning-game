"""Skill: a learning area a game module targets — PRD §4."""

from typing import Optional

from sqlmodel import Field, SQLModel


class Skill(SQLModel, table=True):
    id: str = Field(primary_key=True)  # e.g. "phonics", "arithmetic_fluency"
    title: str
    description: Optional[str] = None
