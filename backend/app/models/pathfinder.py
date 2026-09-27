"""Pathfinder: No Way Back — per-profile saved state.

The levels themselves ship with the client (`pathfinderLevels.ts`); what
lives here is everything a kid produces while playing, so it follows the
profile rather than whichever browser they happened to play on:

- `PathfinderLevelCompletion`: one row per (profile, curated level) the kid
  has finished. Unlocking is derived from these on the client (finishing
  level N unlocks level N+1).
- `PathfinderCustomMap`: a map the kid built and saved in the map builder.
  `id` is the client-assigned, stable `custom-<uuid>` — renaming never
  changes it. Published maps (from every profile) are listed by
  `/api/pathfinder/published-maps` as `PublishedPathfinderMap`s; finishing
  one is recorded as a `PathfinderLevelCompletion` keyed by the map's id,
  the same as a curated level.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel, UniqueConstraint

from app.util import utcnow

PATHFINDER_DIFFICULTIES = ("easy", "medium", "hard", "legendary")


class PathfinderLevelCompletion(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("profile_id", "level_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    level_id: str
    completed_at: datetime = Field(default_factory=utcnow)


class PathfinderCompletionsCreate(BaseModel):
    """Inbound POST body for /api/profiles/{id}/pathfinder/completions.
    A list so a bulk import is one request; already-completed ids are
    ignored, so re-posting is harmless."""

    level_ids: list[str]


class GridPosition(BaseModel):
    row: int
    col: int


class PathfinderCustomMap(SQLModel, table=True):
    id: str = Field(primary_key=True)
    profile_id: int = Field(foreign_key="profile.id", index=True)
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[dict[str, int]] = Field(sa_column=Column(JSON))
    published: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)


class PathfinderCustomMapCreate(BaseModel):
    """Inbound POST body for /api/profiles/{id}/pathfinder/maps. Not a table
    — `PathfinderCustomMap` is the persisted shape."""

    id: str
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[GridPosition]


class PathfinderCustomMapUpdate(BaseModel):
    """Inbound PATCH body — rename and publish/unpublish. All fields
    optional, same pattern as `PieceUpdate`."""

    name: Optional[str] = None
    published: Optional[bool] = None


class PublishedPathfinderMap(BaseModel):
    """Outbound row for the Published Maps screen — a published custom map
    plus its builder's name, so players can see whose map they're playing."""

    id: str
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[GridPosition]
    author_profile_id: int
    author_name: str
    created_at: datetime
