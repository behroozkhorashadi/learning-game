"""POST /api/profiles — backs the create-profile screen. PATCH/DELETE
/api/profiles/{id} and POST /api/admin/login — backs the admin screen
(app/admin_auth.py's hardcoded password gate)."""

from datetime import date

from app.admin_auth import ADMIN_PASSWORD

ADMIN_HEADERS = {"X-Admin-Password": ADMIN_PASSWORD}


def _create_profile(client, **overrides) -> dict:
    payload = {"name": "Test Kid", "avatar": "owl", "birth_year": date.today().year - 7}
    payload.update(overrides)
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201
    return response.json()


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


def test_admin_login_accepts_correct_password(client):
    response = client.post("/api/admin/login", json={"password": ADMIN_PASSWORD})
    assert response.status_code == 204


def test_admin_login_rejects_wrong_password(client):
    response = client.post("/api/admin/login", json={"password": "nope"})
    assert response.status_code == 401


def test_patch_profile_without_admin_header_is_rejected(client):
    profile = _create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "New Name"})
    assert response.status_code == 401


def test_patch_profile_with_wrong_admin_header_is_rejected(client):
    profile = _create_profile(client)
    response = client.patch(
        f"/api/profiles/{profile['id']}", json={"name": "New Name"}, headers={"X-Admin-Password": "nope"}
    )
    assert response.status_code == 401


def test_patch_profile_updates_only_provided_fields(client):
    profile = _create_profile(client, name="Original", avatar="fox")

    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed"}, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["avatar"] == "fox"


def test_patch_profile_rejects_invalid_avatar(client):
    profile = _create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"avatar": "dragon"}, headers=ADMIN_HEADERS)
    assert response.status_code == 422


def test_patch_unknown_profile_is_404(client):
    response = client.patch("/api/profiles/999999", json={"name": "X"}, headers=ADMIN_HEADERS)
    assert response.status_code == 404


def test_delete_profile_without_admin_header_is_rejected(client):
    profile = _create_profile(client)
    response = client.delete(f"/api/profiles/{profile['id']}")
    assert response.status_code == 401


def test_delete_profile_removes_it(client):
    profile = _create_profile(client)

    response = client.delete(f"/api/profiles/{profile['id']}", headers=ADMIN_HEADERS)
    assert response.status_code == 204

    listed = client.get("/api/profiles").json()
    assert all(p["id"] != profile["id"] for p in listed)


def test_delete_profile_also_removes_its_dependent_rows(client):
    profile = _create_profile(client)
    pid = profile["id"]

    piece = client.post("/api/pieces", json={"profile_id": pid, "game_id": "prompt_forge", "body": "hi"}).json()
    client.post(
        "/api/pieces/{}/illustrations".format(piece["id"]),
        json={"prompt_excerpt": "hi", "image_url": "http://example.com/x.png"},
    )
    client.post("/api/ratings", json={"profile_id": pid, "game_id": "prompt_forge", "scale": "stars_1_5", "value": 5})

    response = client.delete(f"/api/profiles/{pid}", headers=ADMIN_HEADERS)
    assert response.status_code == 204

    assert client.get(f"/api/pieces/{piece['id']}").status_code == 404


def test_delete_unknown_profile_is_404(client):
    response = client.delete("/api/profiles/999999", headers=ADMIN_HEADERS)
    assert response.status_code == 404
