"""Rating: an explicit kid-provided engagement score — PRD §4, §5.2.

Sampling behavior (asking roughly one session in N) is out of scope for this
task; this only models the record shape.
"""

from datetime import datetime
from typing import Optional

from app.util import utcnow
from sqlmodel import Field, SQLModel

from app.models.enums import RatingScale


class Rating(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    variant_id: Optional[str] = None
    scale: RatingScale
    value: int
    created_at: datetime = Field(default_factory=utcnow)
