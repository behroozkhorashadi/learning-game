"""Rating: an explicit kid-provided engagement score — PRD §4, §5.2.

Sampling behavior (asking roughly one session in N) is out of scope for this
task; this only models the record shape.
"""

from datetime import datetime
from typing import Optional

from app.util import utcnow
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Field, SQLModel

from app.models.enums import RatingScale


class RatingCreate(BaseModel):
    """Inbound POST body for /api/ratings. Not a table — `Rating` is the
    persisted shape. `value` is bounded to 1-5 for both scales currently
    defined (RatingScale.FACES and .STARS_1_5 are both 5-point scales)."""

    profile_id: int
    game_id: str
    variant_id: Optional[str] = None
    scale: RatingScale
    value: int = PydanticField(ge=1, le=5)


class Rating(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    variant_id: Optional[str] = None
    scale: RatingScale
    value: int
    created_at: datetime = Field(default_factory=utcnow)
