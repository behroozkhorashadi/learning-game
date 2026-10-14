"""Looks over HTTP, on the in-memory store with profiles 1 and 2."""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.armory.looks_routes_effect import bind_looks_routes
from app.armory.looks_service_effect import make_looks_service
from tests.armory.armory_fakes import InMemoryLooksRepository, art_piece, bought, profile_exists

LOOKS = "/api/profiles/1/armory/looks"


@pytest.fixture
def repository() -> InMemoryLooksRepository:
    return InMemoryLooksRepository()


@pytest.fixture
def client(repository: InMemoryLooksRepository) -> httpx.Client:
    app = FastAPI()
    app.include_router(
        bind_looks_routes(service=make_looks_service(repository=repository, profile_exists=profile_exists))
    )
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_save_then_read(client: httpx.Client, repository: InMemoryLooksRepository) -> None:
    repository.append([bought("emblem_maker"), bought("horde_billboard")])
    repository.add_art(art_piece("a1"))
    looks = {"emblem": {"symbol": "rocket", "color": "#FFAA00", "place": "both"}, "hung": {"horde": "a1"}}
    saved = client.put(LOOKS, json=looks)
    assert saved.status_code == 200
    assert saved.json()["pictures"] == {"a1": "/static/armory-art/a1.jpg"}
    read = client.get(LOOKS).json()
    assert read["looks"]["emblem"] == {"symbol": "rocket", "art_id": None, "color": "#FFAA00", "place": "both"}
    assert read["looks"]["hung"] == {"pathfinder": None, "horde": "a1"}


def test_refusals_map_to_status_codes(client: httpx.Client) -> None:
    assert client.get("/api/profiles/9/armory/looks").status_code == 404
    assert client.put(LOOKS, json={"blaster_color": "#00FF88"}).status_code == 409
    assert client.put(LOOKS, json={"blaster_color": "green"}).status_code == 422
    assert client.put(LOOKS, json={"wings": True}).status_code == 422
