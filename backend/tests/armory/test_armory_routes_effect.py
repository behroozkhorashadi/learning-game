"""The armory over HTTP, on the in-memory ledger with profiles 1 and 2."""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.armory.armory_routes_effect import bind_armory_routes
from app.armory.armory_service_effect import make_armory_service
from tests.armory.armory_fakes import InMemoryArmoryRepository, clock, profile_exists

ARMORY = "/api/profiles/1/armory"


@pytest.fixture
def client() -> httpx.Client:
    service = make_armory_service(repository=InMemoryArmoryRepository(), profile_exists=profile_exists, clock=clock)
    app = FastAPI()
    app.include_router(bind_armory_routes(service=service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def test_earn_then_buy(client: httpx.Client) -> None:
    assert client.get(ARMORY).json()["balance"] == 0
    banked = client.post(f"{ARMORY}/rounds", json={"points": 260, "grenades_used": 1})
    assert (banked.status_code, banked.json()["balance"], banked.json()["grenades"]) == (200, 260, 0)
    bought = client.post(f"{ARMORY}/purchases", json={"item_id": "rapid_blaster"})
    assert bought.status_code == 200
    assert bought.json()["balance"] == 10
    assert "rapid_blaster" in bought.json()["owned"]


def test_refusals_map_to_status_codes(client: httpx.Client) -> None:
    assert client.post(f"{ARMORY}/purchases", json={"item_id": "rapid_blaster"}).status_code == 409
    assert client.post(f"{ARMORY}/purchases", json={"item_id": "laser_sword"}).status_code == 404
    assert client.post(f"{ARMORY}/purchases", json={"item_id": "starter_blaster"}).status_code == 409
    assert client.get("/api/profiles/9/armory").status_code == 404
    assert client.post(f"{ARMORY}/rounds", json={"points": -5, "grenades_used": 0}).status_code == 422


def test_buying_rounds_and_using_them(client: httpx.Client) -> None:
    client.post(f"{ARMORY}/rounds", json={"points": 100, "grenades_used": 0})
    bought = client.post(f"{ARMORY}/purchases", json={"item_id": "armor_piercing"}).json()
    assert bought["ammo"]["armor_piercing"] == 25
    # 40 points left: not enough for a second pack.
    assert client.post(f"{ARMORY}/purchases", json={"item_id": "armor_piercing"}).status_code == 409
    used = client.post(
        f"{ARMORY}/rounds", json={"points": 0, "grenades_used": 0, "rounds_used": {"armor_piercing": 10}}
    )
    assert used.json()["ammo"]["armor_piercing"] == 15
