from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.parents.parents_routes_effect import bind_parents_routes
from tests.parents.parents_fakes import (
    ADMIN_PASSWORD,
    KID_ID,
    HistoryBuilder,
    ParentHarness,
    days_ago,
    fact,
    parent_harness,
)


@pytest.fixture
def parents(tmp_path: Path) -> ParentHarness:
    return parent_harness(tmp_path)


@pytest.fixture
def client(parents: ParentHarness) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_parents_routes(service=parents.service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_create_list_and_unlock(client: httpx.Client) -> None:
    created = client.post("/api/parents", json={"name": "Mom", "password": "secret"})
    assert created.status_code == 201
    parent_id = created.json()["id"]
    assert [p["name"] for p in client.get("/api/parents").json()] == ["Mom"]
    assert client.post(f"/api/parents/{parent_id}/unlock", json={"password": "secret"}).status_code == 204
    wrong = client.post(f"/api/parents/{parent_id}/unlock", json={"password": "nope"})
    assert (wrong.status_code, wrong.json()) == (401, {"detail": "wrong password for this parent"})
    assert client.post("/api/parents/99/unlock", json={"password": "x"}).status_code == 404
    assert client.post("/api/parents", json={"name": "Dad", "password": "x"}).status_code == 422


def test_overview_and_report_read_the_password_header(client: httpx.Client, parents: ParentHarness) -> None:
    parent_id = client.post("/api/parents", json={"name": "Mom", "password": "secret"}).json()["id"]
    parents.family.links[KID_ID] = parent_id
    parents.family.histories[KID_ID] = HistoryBuilder().answers(days_ago(1), [fact(2, "×", 3, 6)] * 2).build()
    auth = {"X-Parent-Password": "secret"}

    kids = client.get(f"/api/parents/{parent_id}/kids", headers=auth)
    assert [k["name"] for k in kids.json()] == ["Rami"]
    assert client.get(f"/api/parents/{parent_id}/kids").status_code == 401

    report = client.get(f"/api/parents/{parent_id}/kids/{KID_ID}/report?days=7", headers=auth).json()
    assert (report["range_days"], report["totals"]["problems"], report["fact_cells"][0]["operator"]) == (7, 2, "×")
    default = client.get(f"/api/parents/{parent_id}/kids/{KID_ID}/report", headers=auth).json()
    assert default["range_days"] == 30
    assert client.get(f"/api/parents/{parent_id}/kids/999/report", headers=auth).status_code == 404
    assert client.get(f"/api/parents/{parent_id}/kids/{KID_ID}/report?days=0", headers=auth).status_code == 422


def test_delete_is_admin_only(client: httpx.Client) -> None:
    parent_id = client.post("/api/parents", json={"name": "Mom", "password": "secret"}).json()["id"]
    assert client.delete(f"/api/parents/{parent_id}", headers={"X-Admin-Password": "secret"}).status_code == 401
    assert client.delete(f"/api/parents/{parent_id}", headers={"X-Admin-Password": ADMIN_PASSWORD}).status_code == 204
    assert client.get("/api/parents").json() == []
