"""Game metadata, per-(profile, game) Level, and Variant — PRD §4, §6, §5.4.

`GameMetadata` is the static game definition (declared once per module, in code)
and is not persisted. `Level` is the mutable, server-owned difficulty state the
adaptive engine (later) reads and writes — PRD §6: "the server owns difficulty
and level selection."
"""

from datetime import datetime
from typing import Any, Optional

from app.util import utcnow
from pydantic import BaseModel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel, UniqueConstraint


class GameMetadata(BaseModel):
    """Static per-game-module definition — PRD §6. Not a DB table."""

    id: str
    title: str
    tagline: str
    skill_ids: list[str]
    min_age: int
    max_age: int
    icon: str
    max_level: int


class Level(SQLModel, table=True):
    """Current difficulty level for one (profile, game) pair. Read and written
    server-side only — PRD §6 constraint 2."""

    __table_args__ = (UniqueConstraint("profile_id", "game_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    value: int = Field(default=1)
    updated_at: datetime = Field(default_factory=utcnow)


class Variant(SQLModel, table=True):
    """Named config overlay on a game module — PRD §5.4. Assignment logic and
    lifecycle (promote/keep/retire) are out of scope for this task; this only
    gives the concept a home so events can carry a `variant_id`."""

    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: str
    key: str
    title: str
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
