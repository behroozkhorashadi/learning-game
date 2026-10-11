"""Zombie Horde round recordings, kept so a playtest can be replayed and asked
about later. The recording itself is the client's format (frontend
horde_recording.pure.lib.ts): stored as-is, checked only for being a JSON object
of a sensible size. The summary fields are what a list shows."""

from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, JsonValue, StringConstraints

# Only the last few rounds per profile are kept: enough to ask about a recent game,
# cheap to store (a 60-second round is a few tens of KB).
KEEP_PER_PROFILE = 3
# Far above a real round's size; anything bigger is a bug, not a recording.
MAX_RECORDING_BYTES = 1_000_000

Outcome = Annotated[str, StringConstraints(min_length=1, max_length=16)]


class ReplayCreate(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    outcome: Outcome
    duration_ms: int = Field(ge=0)
    flags: int = Field(ge=0)
    recording: dict[str, JsonValue]


class ReplaySummary(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    profile_id: int
    created_at: AwareDatetime
    outcome: Outcome
    duration_ms: int
    flags: int
    size_bytes: int


class Replay(BaseModel):
    """A summary and the full recording."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    summary: ReplaySummary
    recording: dict[str, JsonValue]
