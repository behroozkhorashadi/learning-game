"""Capabilities and commands for active-time telemetry."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.engagement.engagement_schemas_pure import EngagementBatch, EngagementSpan, EngagementSummary


class EngagementRepository(Protocol):
    def add(self, spans: Sequence[EngagementSpan], recorded_at: datetime) -> None: ...

    def summary(self) -> tuple[EngagementSummary, ...]: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


@dataclass(frozen=True)
class EngagementService:
    record: Callable[[EngagementBatch], None]
    summary: Callable[[str | None], tuple[EngagementSummary, ...]]
