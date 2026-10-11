"""The art studio over HTTP, on in-memory fakes with profiles 1 and 2."""

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.armory.armory_routes_effect import bind_armory_routes
from app.armory.armory_service_effect import make_armory_service
from app.armory.art_studio_routes_effect import bind_art_studio_routes
from app.armory.art_studio_service_effect import make_art_studio_service
from tests.armory.armory_fakes import (
    SELFIE,
    FakeArtMaker,
    InMemoryArtStore,
    InMemoryArtStudioRepository,
    SequentialIds,
    clock,
    profile_exists,
)

ART = "/api/profiles/1/armory/art"


def client_with(maker: FakeArtMaker) -> httpx.Client:
    repository = InMemoryArtStudioRepository()
    app = FastAPI()
    app.include_router(
        bind_armory_routes(
            service=make_armory_service(repository=repository, profile_exists=profile_exists, clock=clock)
        )
    )
    service = make_art_studio_service(
        repository=repository,
        profile_exists=profile_exists,
        art_maker=maker,
        art_store=InMemoryArtStore(),
        clock=clock,
        new_id=SequentialIds(),
    )
    app.include_router(bind_art_studio_routes(service=service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_earn_then_make_art() -> None:
    http = client_with(FakeArtMaker())
    assert http.get(ART).json() == []
    assert http.post(ART, json={"image_data_url": SELFIE, "style": "pixel_hero"}).status_code == 409
    http.post("/api/profiles/1/armory/rounds", json={"points": 400, "grenades_used": 0})
    made = http.post(ART, json={"image_data_url": SELFIE, "style": "pixel_hero", "idea": "jetpack"})
    assert made.status_code == 201
    assert made.json()["armory"]["balance"] == 100
    assert [piece["idea"] for piece in http.get(ART).json()] == ["jetpack"]


def test_refusals() -> None:
    http = client_with(FakeArtMaker(available=False))
    http.post("/api/profiles/1/armory/rounds", json={"points": 400, "grenades_used": 0})
    assert http.post(ART, json={"image_data_url": SELFIE, "style": "pixel_hero"}).status_code == 503
    assert http.post(ART, json={"image_data_url": "nope", "style": "pixel_hero"}).status_code == 422
    assert http.post(ART, json={"image_data_url": SELFIE, "style": "wizard"}).status_code == 422
    assert http.get("/api/profiles/9/armory/art").status_code == 404
    # Art is bought by making it, not from the shop.
    assert http.post("/api/profiles/1/armory/purchases", json={"item_id": "art_studio"}).status_code == 409
