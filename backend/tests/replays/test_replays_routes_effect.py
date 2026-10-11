"""Recordings over HTTP, on a temp SQLite file with profiles 1 and 2."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.replays.replays_repository_effect import make_sql_replay_repository
from app.replays.replays_routes_effect import bind_replays_routes
from app.replays.replays_service_effect import make_replays_service
from tests.replays.replays_fakes import SequentialIds, TickingClock, profile_exists, recording

REPLAYS = "/api/profiles/1/horde/replays"


@pytest.fixture
def client(tmp_path: Path) -> httpx.Client:
    repository = make_sql_replay_repository(engine=create_engine(f"sqlite:///{tmp_path / 'replays.db'}"))
    repository.create_schema()
    service = make_replays_service(
        repository=repository, profile_exists=profile_exists, clock=TickingClock(), new_id=SequentialIds()
    )
    app = FastAPI()
    app.include_router(bind_replays_routes(service=service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_save_list_and_fetch(client: httpx.Client) -> None:
    saved = client.post(REPLAYS, json=recording(2).model_dump())
    assert saved.status_code == 201
    assert saved.json()["flags"] == 2
    assert saved.json()["size_bytes"] > 0
    assert [s["id"] for s in client.get(REPLAYS).json()] == ["r1"]
    fetched = client.get("/api/horde/replays/r1").json()
    assert fetched["recording"] == recording(2).recording


def test_refusals(client: httpx.Client) -> None:
    assert client.post("/api/profiles/9/horde/replays", json=recording().model_dump()).status_code == 404
    assert client.get("/api/horde/replays/nope").status_code == 404
    assert client.post(REPLAYS, json={"outcome": "left"}).status_code == 422
