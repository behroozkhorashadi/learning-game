from datetime import UTC, datetime

import pytest

from app.engagement.engagement_schemas_pure import EngagementBatch
from app.engagement.engagement_service_effect import make_engagement_service
from tests.engagement.engagement_fakes import MemoryEngagementRepository


def test_service_records_and_admin_reads_summary() -> None:
    repository = MemoryEngagementRepository()
    at = datetime(2026, 1, 2, tzinfo=UTC)

    def verify(password: str | None) -> None:
        if password != "secret":
            raise PermissionError

    service = make_engagement_service(repository=repository, clock=lambda: at, verify_admin=verify)
    service.record(EngagementBatch.model_validate({"spans": [{"area": "home", "active_ms": 4000}]}))

    assert repository.recorded_at == at
    assert service.summary("secret")[0].active_ms == 4000
    with pytest.raises(PermissionError):
        service.summary("wrong")
