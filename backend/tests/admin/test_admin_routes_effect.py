import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.admin.admin_routes_effect import bind_admin_routes
from app.admin.admin_service_effect import make_admin_service


@pytest.fixture
def client() -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_admin_routes(service=make_admin_service(admin_password="admin-secret")))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_admin_login_accepts_correct_password(client: httpx.Client) -> None:
    assert client.post("/api/admin/login", json={"password": "admin-secret"}).status_code == 204


@pytest.mark.parametrize("password", ["nope", ""])
def test_admin_login_rejects_wrong_or_empty_password(client: httpx.Client, password: str) -> None:
    response = client.post("/api/admin/login", json={"password": password})
    assert (response.status_code, response.json()) == (401, {"detail": "invalid admin password"})
