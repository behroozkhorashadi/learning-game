"""Records aggregate active time and exposes an admin-gated summary."""

from collections.abc import Callable
from datetime import datetime

from app.engagement.engagement_ports_pure import EngagementRepository, EngagementService
from app.engagement.engagement_schemas_pure import EngagementBatch, EngagementSummary


def make_engagement_service(
    *,
    repository: EngagementRepository,
    clock: Callable[[], datetime],
    verify_admin: Callable[[str | None], None],
) -> EngagementService:
    def record(batch: EngagementBatch) -> None:
        repository.add(batch.spans, clock())

    def summary(password: str | None) -> tuple[EngagementSummary, ...]:
        verify_admin(password)
        return repository.summary()

    return EngagementService(record=record, summary=summary)
