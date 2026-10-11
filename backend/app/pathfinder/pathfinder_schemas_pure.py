"""Pathfinder: No Way Back — per-profile saved state.

The levels themselves ship with the client (`pathfinderLevels.ts`); what lives here
is everything a kid produces while playing, so it follows the profile rather than
whichever browser they happened to play on:

- a level completion: one row per (profile, curated level) the kid has finished.
  Unlocking is derived from these on the client (finishing level N unlocks N+1).
- `PathfinderCustomMap`: a map the kid built and saved in the map builder. `id` is
  the client-assigned, stable `custom-<uuid>`; renaming never changes it. Published
  maps (from every profile) are listed as `PublishedPathfinderMap`s; finishing one
  is recorded as a completion keyed by the map's id, the same as a curated level.

These are wire shapes: names, fields, and docstrings are the API contract
(`make check-api`), so they keep pydantic's default `extra="ignore"`.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

PATHFINDER_DIFFICULTIES = ("easy", "medium", "hard", "legendary")


def server_set_timestamp() -> datetime:
    """Default factory for timestamps the server always sets: keeps the field optional
    in the published schema (as it always was) without inventing a value."""
    msg = "this timestamp is set by the server"
    raise ValueError(msg)


class PathfinderCompletionsCreate(BaseModel):
    """Inbound POST body for /api/profiles/{id}/pathfinder/completions.
    A list so a bulk import is one request; already-completed ids are
    ignored, so re-posting is harmless."""

    model_config = ConfigDict(frozen=True)

    level_ids: list[str]


class GridPosition(BaseModel):
    model_config = ConfigDict(frozen=True)

    row: int
    col: int


class PathfinderCustomMap(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    profile_id: int
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[dict[str, int]]
    published: bool = False
    created_at: datetime = Field(default_factory=server_set_timestamp)


class PathfinderCustomMapCreate(BaseModel):
    """Inbound POST body for /api/profiles/{id}/pathfinder/maps. Not a table
    — `PathfinderCustomMap` is the persisted shape."""

    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[GridPosition]


class PathfinderCustomMapUpdate(BaseModel):
    """Inbound PATCH body — rename and publish/unpublish. All fields
    optional, same pattern as `PieceUpdate`."""

    model_config = ConfigDict(frozen=True)

    name: str | None = None
    published: bool | None = None


class PublishedPathfinderMap(BaseModel):
    """Outbound row for the Published Maps screen — a published custom map
    plus its builder's name, so players can see whose map they're playing."""

    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    difficulty: str
    rows: int
    columns: int
    dots: list[GridPosition]
    author_profile_id: int
    author_name: str
    created_at: datetime
