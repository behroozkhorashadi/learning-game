"""Playing a game: the static game definitions, the items served, the attempts and
their mandatory telemetry core, explicit ratings, and parent verifications — PRD §4,
§5, §6.

The request/response models are wire shapes: their names, fields, and docstrings are
the API contract the frontend's types are generated from (`make check-api`, and the
legacy `make gen-types`), so they keep pydantic's default `extra="ignore"` and their
docstrings verbatim. The stored shapes (`Attempt`, `Level`, ...) are also exported to
the legacy generated types, so they keep their names.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


def server_set_timestamp() -> datetime:
    """Default factory for timestamps the server always sets: keeps the field optional
    in the published schema (as it always was) without inventing a value."""
    msg = "this timestamp is set by the server"
    raise ValueError(msg)


def server_set_id() -> str:
    """Default factory for ids the server always assigns (see server_set_timestamp)."""
    msg = "this id is set by the server"
    raise ValueError(msg)


class RatingScale(StrEnum):
    """Explicit engagement rating scale — PRD §5.2."""

    FACES = "faces"
    STARS_1_5 = "stars_1_5"


class GameMetadata(BaseModel):
    """Static per-game-module definition — PRD §6. Not a DB table."""

    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    tagline: str
    skill_ids: list[str]
    min_age: int
    max_age: int
    icon: str
    max_level: int


# One playable unit of a game at a chosen config — PRD §4, §6. Not stored: it is produced
# fresh on every request, and its history is the `item_shown` event. May be a single
# challenge or a short round; `payload` is free-form so the client owns how it plays out.
# (A comment, not a docstring: the published schema has never carried a description.)
class Item(BaseModel):
    model_config = ConfigDict(frozen=True)

    item_id: str
    game_id: str
    variant_id: str | None = None
    level: int
    payload: dict[str, object]


class TelemetryCore(BaseModel):
    """The mandatory floor of every Attempt payload — PRD §5.3, §6."""

    model_config = ConfigDict(frozen=True)

    correct: bool | None = None
    score: float | None = None
    hints_used: int = Field(ge=0)
    time_ms: int = Field(ge=0)

    @model_validator(mode="after")
    def _require_correctness_signal(self) -> Self:
        if self.correct is None and self.score is None:
            msg = "telemetry core requires 'correct' and/or 'score'"
            raise ValueError(msg)
        return self


class AttemptCreate(BaseModel):
    """Inbound POST body for /api/attempts. Not a table — `Attempt` is the
    persisted shape."""

    model_config = ConfigDict(frozen=True)

    item_id: str
    profile_id: int
    game_id: str
    variant_id: str | None = None
    session_id: str | None = None
    telemetry: TelemetryCore
    details: dict[str, object] = Field(default_factory=dict)


class Attempt(BaseModel):
    """Persisted attempt. Telemetry-core fields are flattened onto columns for
    queryability; `details` keeps the free-form envelope contents.

    `level` is the difficulty level in effect when this attempt was made
    (server-set, not client-supplied). Loop A's mastery window (PRD §5.1) is
    reconstructed by querying attempts at the profile/game's current level —
    see `app/play/play_service_effect.py`."""

    model_config = ConfigDict(frozen=True)

    id: int | None = None
    item_id: str
    profile_id: int
    game_id: str
    variant_id: str | None = None
    session_id: str | None = None
    level: int
    correct: bool | None = None
    score: float | None = None
    hints_used: int
    time_ms: int
    details: dict[str, object] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=server_set_timestamp)


class AttemptRead(BaseModel):
    """Response shape for POST /api/attempts."""

    model_config = ConfigDict(frozen=True)

    id: int
    correct: bool | None
    score: float | None
    hints_used: int
    time_ms: int
    event_id: str
    # Loop A frustration guard (PRD §5.1): true if this attempt was the second
    # consecutive wrong answer at the current level. Immediate, real-time signal for the
    # client, never a level change.
    hint_offered: bool


class Level(BaseModel):
    """Current difficulty level for one (profile, game) pair. Read and written
    server-side only — PRD §6 constraint 2."""

    model_config = ConfigDict(frozen=True)

    id: int | None = None
    profile_id: int
    game_id: str
    value: int = 1
    updated_at: datetime = Field(default_factory=server_set_timestamp)


class RatingCreate(BaseModel):
    """Inbound POST body for /api/ratings. Not a table — `Rating` is the
    persisted shape. `value` is bounded to 1-5 for both scales currently
    defined (RatingScale.FACES and .STARS_1_5 are both 5-point scales)."""

    model_config = ConfigDict(frozen=True)

    profile_id: int
    game_id: str
    variant_id: str | None = None
    scale: RatingScale
    value: int = Field(ge=1, le=5)


class Rating(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    profile_id: int
    game_id: str
    variant_id: str | None = None
    scale: RatingScale
    value: int
    created_at: datetime = Field(default_factory=server_set_timestamp)


class VerificationCreate(BaseModel):
    """Inbound POST body for /api/verifications. Not a table — `Verification`
    is the persisted shape."""

    model_config = ConfigDict(frozen=True)

    attempt_id: int
    correct: bool
    verified_by: str = "parent"


class Verification(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    attempt_id: int
    correct: bool
    verified_at: datetime = Field(default_factory=server_set_timestamp)
    verified_by: str = "parent"


# --- Stored shapes with no behavior yet: kept (and exported to the legacy generated
# types) so their tables and the frontend's types stay as they were. ---


class Variant(BaseModel):
    """Named config overlay on a game module — PRD §5.4. Assignment logic and
    lifecycle (promote/keep/retire) are out of scope for this task; this only
    gives the concept a home so events can carry a `variant_id`."""

    model_config = ConfigDict(frozen=True)

    id: int | None = None
    game_id: str
    key: str
    title: str
    config: dict[str, object] = Field(default_factory=dict)
    is_active: bool = True


class PlaySession(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=server_set_id)
    profile_id: int
    game_id: str
    variant_id: str | None = None
    started_at: datetime = Field(default_factory=server_set_timestamp)
    ended_at: datetime | None = None


class Skill(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    description: str | None = None


class SkillState(BaseModel):
    """Per-(profile, skill) mastery rollup. Distinct from the per-(profile, game)
    `Level` in game.py: this is the coarser, skill-level summary the mastery
    signal (PRD §5.1) will eventually roll up into. No behavior writes to it yet.
    """

    model_config = ConfigDict(frozen=True)

    id: int | None = None
    profile_id: int
    skill_id: str
    mastery_level: int = 1


@dataclass(frozen=True)
class PracticeSettings:
    """A parent-set practice config, as item generation needs it."""

    difficulty: int
    operations: tuple[str, ...]
    focus_numbers: dict[str, list[int]]
