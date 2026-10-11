import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.crash_reports.crash_reports_routes_effect import bind_crash_reports_routes
from app.crash_reports.crash_reports_service_effect import make_crash_reports_service
from tests.crash_reports.crash_reports_fakes import InMemoryClientErrorLog


def _client(log: InMemoryClientErrorLog) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_crash_reports_routes(service=make_crash_reports_service(log=log)))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_a_report_is_logged_and_answered_with_204() -> None:
    log = InMemoryClientErrorLog()
    body = {"message": "boom", "source": "react-error-boundary", "url": "/", "user_agent": "ua", "profile_id": 1}
    response = _client(log).post("/api/client-errors", json=body)
    assert response.status_code == 204
    assert "source=react-error-boundary" in log.entries[0]


def test_a_malformed_report_is_rejected_and_not_logged() -> None:
    log = InMemoryClientErrorLog()
    assert _client(log).post("/api/client-errors", json={"message": "boom"}).status_code == 422
    assert log.entries == []
