"""Event: the append-only telemetry record — PRD §5.3.

Every metric both adaptive loops need derives from this stream. Rows are never
updated or deleted after insert; see `app.events.log.append_event`.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from app.util import utcnow
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.enums import EventType


class Event(SQLModel, table=True):
    event_id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    timestamp: datetime = Field(default_factory=utcnow)
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    variant_id: Optional[str] = None
    session_id: Optional[str] = None
    event_type: EventType
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
