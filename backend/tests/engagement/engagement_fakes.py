from collections.abc import Sequence
from datetime import datetime

from app.engagement.engagement_schemas_pure import EngagementSpan, EngagementSummary


class MemoryEngagementRepository:
    def __init__(self) -> None:
        self.spans: list[EngagementSpan] = []
        self.recorded_at: datetime | None = None

    def add(self, spans: Sequence[EngagementSpan], recorded_at: datetime) -> None:
        self.spans.extend(spans)
        self.recorded_at = recorded_at

    def summary(self) -> tuple[EngagementSummary, ...]:
        totals: dict[str, int] = {}
        for span in self.spans:
            totals[span.area] = totals.get(span.area, 0) + span.active_ms
        return tuple(EngagementSummary(area=area, active_ms=active_ms) for area, active_ms in totals.items())

    def delete_for_profile(self, profile_id: int) -> None:
        self.spans = [span for span in self.spans if span.profile_id != profile_id]
