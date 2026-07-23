"""PlaySession: a bounded run of items for one kid in one game — PRD §4.

Named `PlaySession` (not `Session`) to avoid colliding with SQLModel's own
`Session` (the DB session type) used throughout the codebase.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from app.util import utcnow
from sqlmodel import Field, SQLModel


class PlaySession(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    variant_id: Optional[str] = None
    started_at: datetime = Field(default_factory=utcnow)
    ended_at: Optional[datetime] = None
