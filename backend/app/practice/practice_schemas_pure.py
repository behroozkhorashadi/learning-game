"""Parent-set practice-mode config for math games: which operations are in play,
which fact-family numbers to bias toward (e.g. "focus on 7 and 8" for
multiplication), and an explicit difficulty, instead of only the server-adaptive
Level (PRD §5.1's Loop A).

Not every game supports this; the play feature says which do (today only
`fact_fluency`, Equation Outbreak). One row per (profile, game): setting a config
switches that game's item generation for that kid to manual mode; deleting the row
reverts to the adaptive Level.

Known limitation: while a config is active, Loop A still runs against the attempts
it produces, using `difficulty` as the attempt's level, so drilling a narrow,
parent-chosen slice of facts can nudge the adaptive Level. Accepted for v1.

These are wire shapes: their names, fields, and docstrings are the API contract the
frontend's types are generated from (`make check-api`), so they keep pydantic's
default `extra="ignore"`.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


def server_set_timestamp() -> datetime:
    """Default factory for timestamps the server always sets. It keeps the field
    optional in the published schema (as it always was) without inventing a value."""
    msg = "this timestamp is set by the server"
    raise ValueError(msg)


class PracticeConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    profile_id: int
    game_id: str
    operations: list[str]
    # Per-operation numbers to bias toward, e.g. {"×": [7, 8]}. An operation absent
    # from this dict (or mapped to an empty list) means "no focus, full range".
    focus_numbers: dict[str, list[int]] = Field(default_factory=dict)
    difficulty: int
    updated_at: datetime = Field(default_factory=server_set_timestamp)


class PracticeConfigUpsert(BaseModel):
    """Inbound PUT body for /api/practice-config. Not a table — `PracticeConfig`
    is the persisted shape."""

    model_config = ConfigDict(frozen=True)

    profile_id: int
    game_id: str
    operations: list[str]
    focus_numbers: dict[str, list[int]] = {}
    difficulty: int
