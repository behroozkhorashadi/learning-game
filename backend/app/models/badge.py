"""Badge, BadgeAward — the awarding model proposed in HANDOFF.md §4.

Badges are fixed, seeded content (there's no admin UI to define new ones) —
see `app.services.badges_service.SEED_BADGES`. Awarding is derived by
evaluating each badge's `criteria` JSON against the profile's
Attempt/Piece/Rating history (`app.services.badges_service`), not
client-supplied. Streaks/totals shown alongside badges on the Accomplishments
screen are NOT modeled here — HANDOFF.md §4 says those should derive from the
Event/Attempt/Rating log at read time rather than being stored; see
`ProfileStats` in `app.models.stats`.
"""

from datetime import datetime
from typing import Any, Optional

from app.util import utcnow
from pydantic import BaseModel
from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


class Badge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    name: str
    description: str
    art_url: str
    criteria: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class BadgeAward(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("profile_id", "badge_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    badge_id: int = Field(foreign_key="badge.id")
    session_id: Optional[str] = None
    awarded_at: datetime = Field(default_factory=utcnow)


class BadgeStatus(BaseModel):
    """Response shape for GET /api/profiles/{profile_id}/badges — a Badge
    joined with whether (and when) this profile earned it."""

    key: str
    name: str
    description: str
    art_url: str
    earned: bool
    awarded_at: Optional[datetime] = None
