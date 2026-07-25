"""Verification: parent-confirmed completion of a physical write-out step — PRD §4, §6.

Corresponds to a game module's optional `postStep`. The PIN gate that guards
this on the frontend is a lightweight kid-deterrent, not a security boundary
(no server-side PIN check — that's a later milestone if ever needed); this
only gives the confirmation record a home.
"""

from datetime import datetime
from typing import Optional

from app.util import utcnow
from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class VerificationCreate(BaseModel):
    """Inbound POST body for /api/verifications. Not a table — `Verification`
    is the persisted shape."""

    attempt_id: int
    correct: bool
    verified_by: str = "parent"


class Verification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(foreign_key="attempt.id")
    correct: bool
    verified_at: datetime = Field(default_factory=utcnow)
    verified_by: str = Field(default="parent")
