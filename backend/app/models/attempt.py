"""Attempt: the client's result payload, and its required telemetry core — PRD §4, §6.

The envelope (`details`) is free-form per game. The telemetry core is not: every
attempt must carry correctness-or-score, hints used, and timing, because both the
real-time difficulty engine and the event log depend on it (PRD §5.3, §6). A
payload missing the core is rejected by pydantic validation before it reaches
the database.
"""

from datetime import datetime
from typing import Any, Optional

from app.util import utcnow
from pydantic import BaseModel, Field as PydanticField, model_validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class TelemetryCore(BaseModel):
    """The mandatory floor of every Attempt payload — PRD §5.3, §6."""

    correct: Optional[bool] = None
    score: Optional[float] = None
    hints_used: int = PydanticField(ge=0)
    time_ms: int = PydanticField(ge=0)

    @model_validator(mode="after")
    def _require_correctness_signal(self) -> "TelemetryCore":
        if self.correct is None and self.score is None:
            raise ValueError("telemetry core requires 'correct' and/or 'score'")
        return self


class AttemptCreate(BaseModel):
    """Inbound POST body for /api/attempts. Not a table — `Attempt` is the
    persisted shape."""

    item_id: str
    profile_id: int
    game_id: str
    variant_id: Optional[str] = None
    session_id: Optional[str] = None
    telemetry: TelemetryCore
    details: dict[str, Any] = PydanticField(default_factory=dict)


class Attempt(SQLModel, table=True):
    """Persisted attempt. Telemetry-core fields are flattened onto columns for
    queryability; `details` keeps the free-form envelope contents."""

    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: str
    profile_id: int = Field(foreign_key="profile.id")
    game_id: str
    variant_id: Optional[str] = None
    session_id: Optional[str] = None
    correct: Optional[bool] = None
    score: Optional[float] = None
    hints_used: int
    time_ms: int
    details: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)


class AttemptRead(BaseModel):
    """Response shape for POST /api/attempts."""

    id: int
    correct: Optional[bool]
    score: Optional[float]
    hints_used: int
    time_ms: int
    event_id: str
