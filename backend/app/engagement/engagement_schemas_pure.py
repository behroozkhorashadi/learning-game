"""Wire and reporting shapes for privacy-conscious active-time telemetry."""

from pydantic import BaseModel, ConfigDict, Field


class EngagementSpan(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    area: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9:_-]*$")
    active_ms: int = Field(ge=1, le=60_000)
    profile_id: int | None = Field(default=None, ge=1)


class EngagementBatch(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    spans: tuple[EngagementSpan, ...] = Field(min_length=1, max_length=100)


class EngagementSummary(BaseModel):
    model_config = ConfigDict(frozen=True)

    area: str
    active_ms: int
