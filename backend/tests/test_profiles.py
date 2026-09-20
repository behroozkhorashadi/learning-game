"""POST /api/profiles — backs the create-profile screen."""

from datetime import date


def test_create_profile_round_trips(client):
    response = client.post(
        "/api/profiles",
        json={"name": "Timmy", "avatar": "owl", "birth_year": date.today().year - 7, "reading_support": True},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] is not None
    assert body["name"] == "Timmy"
    assert body["avatar"] == "owl"
    assert body["reading_support"] is True

    listed = client.get("/api/profiles").json()
    assert any(p["id"] == body["id"] and p["name"] == "Timmy" for p in listed)


def test_create_profile_trims_whitespace_from_name(client):
    response = client.post(
        "/api/profiles",
        json={"name": "  Sam  ", "avatar": "fox", "birth_year": date.today().year - 6},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Sam"


def test_create_profile_rejects_blank_name(client):
    response = client.post(
        "/api/profiles",
        json={"name": "   ", "avatar": "fox", "birth_year": date.today().year - 6},
    )

    assert response.status_code == 422


def test_create_profile_rejects_unknown_avatar(client):
    response = client.post(
        "/api/profiles",
        json={"name": "Ada", "avatar": "dragon", "birth_year": date.today().year - 6},
    )

    assert response.status_code == 422


def test_create_profile_rejects_age_outside_bounds(client):
    too_old = client.post(
        "/api/profiles",
        json={"name": "Ada", "avatar": "fox", "birth_year": date.today().year - 40},
    )
    too_young = client.post(
        "/api/profiles",
        json={"name": "Ada", "avatar": "fox", "birth_year": date.today().year + 1},
    )

    assert too_old.status_code == 422
    assert too_young.status_code == 422
