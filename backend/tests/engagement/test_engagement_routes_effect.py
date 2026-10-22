from datetime import UTC, datetime

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.engagement.engagement_routes_effect import bind_engagement_routes
from app.engagement.engagement_service_effect import make_engagement_service
from tests.engagement.engagement_fakes import MemoryEngagementRepository


def _client(repository: MemoryEngagementRepository) -> httpx.Client:
    def verify(password: str | None) -> None:
        if password != "secret":
            raise PermissionError

    service = make_engagement_service(
        repository=repository,
        clock=lambda: datetime(2026, 1, 2, tzinfo=UTC),
        verify_admin=verify,
    )
    app = FastAPI()
    app.include_router(bind_engagement_routes(service=service))
    return TestClient(app)


def test_routes_record_and_protect_the_summary() -> None:
    client = _client(MemoryEngagementRepository())
    response = client.post("/api/engagement", json={"spans": [{"area": "home", "active_ms": 5000}]})
    assert response.status_code == 204
    assert client.get("/api/admin/engagement").status_code == 401
    summary = client.get("/api/admin/engagement", headers={"X-Admin-Password": "secret"})
    assert summary.json() == [{"area": "home", "active_ms": 5000}]
