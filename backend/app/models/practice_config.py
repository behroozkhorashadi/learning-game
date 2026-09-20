"""Parent-set practice-mode config for math games — lets a parent choose
which operations are in play, bias practice toward specific fact-family
numbers (e.g. "focus on 7 and 8" for multiplication), and pin an explicit
difficulty, instead of only the server-adaptive Level (PRD §5.1's Loop A).

Not every game supports this — see `GameModule.supports_practice_config()`
in `app/games/base.py`. Today only `fact_fluency` (Equation Outbreak) does.

One row per (profile, game): setting a config switches that game's item
generation for that kid to manual mode; deleting the row reverts to the
adaptive Level.

Known limitation: while a config is active, Loop A's promote/hold/support
engine (`app/services/loop_a_service.py`) still runs against the attempts
it produces, using `difficulty` as the attempt's level. Drilling a narrow,
parent-chosen slice of facts can therefore nudge the adaptive Level in ways
a broad, unbiased attempt wouldn't — accepted for v1 rather than threading a
"this attempt came from a practice config" flag through the attempt
pipeline to suppress it.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel, UniqueConstraint

from app.util import utcnow


class PracticeConfig(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("profile_id", "game_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    operations: list[str] = Field(sa_column=Column(JSON))
    # Per-operation numbers to bias toward, e.g. {"×": [7, 8]}. An operation
    # absent from this dict (or mapped to an empty list) means "no focus,
    # full range" for that operation.
    focus_numbers: dict[str, list[int]] = Field(default_factory=dict, sa_column=Column(JSON))
    difficulty: int
    updated_at: datetime = Field(default_factory=utcnow)


class PracticeConfigUpsert(BaseModel):
    """Inbound PUT body for /api/practice-config. Not a table — `PracticeConfig`
    is the persisted shape."""

    profile_id: int
    game_id: str
    operations: list[str]
    focus_numbers: dict[str, list[int]] = {}
    difficulty: int
