"""Verification: parent-confirmed completion of a physical write-out step — PRD §4, §6.

Corresponds to a game module's optional `postStep`. No PIN-check logic lives
here yet (that's a later milestone) — this only gives the record a home.
"""

from datetime import datetime
from typing import Optional

from app.util import utcnow
from sqlmodel import Field, SQLModel


class Verification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(foreign_key="attempt.id")
    verified_at: datetime = Field(default_factory=utcnow)
    verified_by: str = Field(default="parent")
