"""POST /api/profiles — backs the create-profile screen. PATCH/DELETE
/api/profiles/{id} and POST /api/admin/login — backs the admin screen
(app/admin_auth.py's hardcoded password gate)."""

import base64
from datetime import date

import pytest

from app import admin_auth
from app.admin_auth import ADMIN_PASSWORD

ADMIN_HEADERS = {"X-Admin-Password": ADMIN_PASSWORD}


@pytest.fixture
def no_admin_password(monkeypatch):
    """Simulates an unset/empty ADMIN_PASSWORD. The module reads the env var
    once at import, so the fixture patches the module global rather than the
    environment — `verify_admin_password` resolves it at call time."""
    monkeypatch.setattr(admin_auth, "ADMIN_PASSWORD", "")


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


def test_create_profile_saves_captured_photo(client, monkeypatch):
    monkeypatch.setattr("app.main.save_profile_avatar", lambda data_url: "/static/profile-avatars/test.png")
    response = client.post(
        "/api/profiles",
        json={
            "name": "Ada",
            "avatar": "fox",
            "birth_year": date.today().year - 6,
            "avatar_image_data_url": "data:image/png;base64,example",
        },
    )

    assert response.status_code == 201
    assert response.json()["avatar"] == "/static/profile-avatars/test.png"


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


def test_admin_login_accepts_empty_password_when_none_is_configured(client, no_admin_password):
    """An unset ADMIN_PASSWORD means the password is the empty string — the
    admin screen must open rather than being 503'd or 401'd shut."""
    response = client.post("/api/admin/login", json={"password": ""})
    assert response.status_code == 204


def test_admin_login_rejects_nonempty_password_when_none_is_configured(client, no_admin_password):
    response = client.post("/api/admin/login", json={"password": "nope"})
    assert response.status_code == 401


def test_admin_endpoints_open_without_header_when_no_password_is_configured(client, no_admin_password):
    """The header is absent (None), not empty — it still has to be treated as
    the empty string and pass, or a no-password setup can't edit anything."""
    profile = _create_profile(client)

    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed"})

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


@pytest.fixture
def admin_password(monkeypatch):
    monkeypatch.setattr(admin_auth, "ADMIN_PASSWORD", "admin-secret")
    return "admin-secret"


def test_patch_unprotected_profile_needs_no_password(client, admin_password):
    """A profile with no password is editable by anyone, same as creating one."""
    profile = _create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_profile_password_is_never_returned(client):
    profile = _create_profile(client, password="tiger42")

    assert profile["has_password"] is True
    assert not any("hash" in key or key == "password" for key in profile)
    listed = next(p for p in client.get("/api/profiles").json() if p["id"] == profile["id"])
    assert listed["has_password"] is True
    assert not any("hash" in key or key == "password" for key in listed)


def test_create_profile_rejects_too_short_password(client):
    response = client.post(
        "/api/profiles", json={"name": "Ada", "avatar": "fox", "birth_year": date.today().year - 6, "password": "abc"}
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("password", "expected"),
    [("tiger42", 204), ("wrong", 401), ("", 401), ("admin-secret", 204)],
)
def test_unlock_accepts_profile_password_or_admin_override(client, admin_password, password, expected):
    profile = _create_profile(client, password="tiger42")
    response = client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": password})
    assert response.status_code == expected


def test_unlock_without_configured_admin_password_has_no_blank_override(client, no_admin_password):
    """With ADMIN_PASSWORD unset, the admin password is "" — that must not
    turn a blank entry into a skeleton key for every protected profile."""
    profile = _create_profile(client, password="tiger42")

    assert client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": ""}).status_code == 401
    assert client.patch(f"/api/profiles/{profile['id']}", json={"name": "X"}).status_code == 401
    assert client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": "tiger42"}).status_code == 204


def test_unlock_unprotected_profile_always_succeeds(client):
    profile = _create_profile(client)
    assert client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": ""}).status_code == 204


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({}, 401),
        ({"X-Profile-Password": "wrong"}, 401),
        ({"X-Profile-Password": "tiger42"}, 200),
        ({"X-Profile-Password": "admin-secret"}, 200),
        ({"X-Admin-Password": "admin-secret"}, 200),
        ({"X-Admin-Password": "wrong"}, 401),
    ],
)
def test_patch_protected_profile_needs_its_password_or_admin(client, admin_password, headers, expected):
    profile = _create_profile(client, password="tiger42")
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed"}, headers=headers)
    assert response.status_code == expected


def test_change_and_remove_profile_password(client, admin_password):
    profile = _create_profile(client, password="tiger42")
    url = f"/api/profiles/{profile['id']}"

    changed = client.patch(url, json={"password": "lion99"}, headers={"X-Profile-Password": "tiger42"})
    assert changed.status_code == 200 and changed.json()["has_password"] is True
    assert client.post(f"{url}/unlock", json={"password": "tiger42"}).status_code == 401
    assert client.post(f"{url}/unlock", json={"password": "lion99"}).status_code == 204

    # Forgotten password: the admin override can clear it.
    removed = client.patch(url, json={"remove_password": True}, headers={"X-Admin-Password": "admin-secret"})
    assert removed.status_code == 200 and removed.json()["has_password"] is False
    assert client.patch(url, json={"name": "Open again"}).status_code == 200


def test_patch_rejects_setting_and_removing_password_together(client):
    profile = _create_profile(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"password": "lion99", "remove_password": True})
    assert response.status_code == 422


def test_patch_rejects_bad_new_password_without_changing_anything(client):
    profile = _create_profile(client, name="Before")
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "After", "password": "ab"})
    assert response.status_code == 422
    listed = next(p for p in client.get("/api/profiles").json() if p["id"] == profile["id"])
    assert listed["name"] == "Before" and listed["has_password"] is False


def test_delete_profile_removes_its_password(client, admin_password):
    from sqlmodel import Session

    from app.db import engine
    from app.models.profile import ProfilePassword

    profile = _create_profile(client, password="tiger42")
    response = client.delete(f"/api/profiles/{profile['id']}", headers={"X-Admin-Password": "admin-secret"})

    assert response.status_code == 204
    with Session(engine) as session:
        assert session.get(ProfilePassword, profile["id"]) is None


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


PHOTO_DATA_URL = "data:image/png;base64," + base64.b64encode(b"fake-png-bytes").decode()


@pytest.fixture
def avatars_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.profile_avatars.PROFILE_AVATARS_DIR", tmp_path)
    return tmp_path


def test_patch_profile_replaces_photo_and_removes_the_old_file(client, avatars_dir):
    profile = _create_profile(client, avatar_image_data_url=PHOTO_DATA_URL)
    old_file = avatars_dir / profile["avatar"].rsplit("/", 1)[-1]
    assert old_file.exists()

    response = client.patch(
        f"/api/profiles/{profile['id']}", json={"avatar_image_data_url": PHOTO_DATA_URL}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    new_avatar = response.json()["avatar"]
    assert new_avatar.startswith("/static/profile-avatars/") and new_avatar != profile["avatar"]
    assert not old_file.exists()
    assert (avatars_dir / new_avatar.rsplit("/", 1)[-1]).exists()


def test_patch_profile_keeps_existing_photo_when_resent(client, avatars_dir):
    """The edit screen sends the current avatar back unchanged when only the
    name changes — a saved photo's /static path must not fail validation."""
    profile = _create_profile(client, avatar_image_data_url=PHOTO_DATA_URL)

    response = client.patch(
        f"/api/profiles/{profile['id']}", json={"name": "Renamed", "avatar": profile["avatar"]}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert response.json()["avatar"] == profile["avatar"]
    assert (avatars_dir / profile["avatar"].rsplit("/", 1)[-1]).exists()


def test_patch_profile_can_switch_from_photo_to_animal(client, avatars_dir):
    profile = _create_profile(client, avatar_image_data_url=PHOTO_DATA_URL)

    response = client.patch(f"/api/profiles/{profile['id']}", json={"avatar": "panda"}, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["avatar"] == "panda"
    assert list(avatars_dir.iterdir()) == []


def test_remix_returns_preview_without_saving(client, avatars_dir, monkeypatch):
    calls = []

    def fake_remix(data_url, style, idea):
        calls.append((style, idea))
        from app.services.image_generation import GeneratedImage

        return GeneratedImage(content=b"remixed", content_type="image/jpeg")

    monkeypatch.setattr("app.main.remix_profile_photo", fake_remix)
    response = client.post(
        "/api/profile-photos/remix", json={"image_data_url": PHOTO_DATA_URL, "style": "wizard", "idea": "rainbow hair"}
    )

    assert response.status_code == 200
    assert response.json()["image_data_url"] == "data:image/jpeg;base64," + base64.b64encode(b"remixed").decode()
    assert calls == [("wizard", "rainbow hair")]
    assert list(avatars_dir.iterdir()) == []


@pytest.mark.parametrize(
    "body",
    [
        {"style": "not-a-style"},
        {"idea": "x" * 121},
        {},
        {"idea": "   "},
    ],
)
def test_remix_rejects_bad_input(client, body):
    response = client.post("/api/profile-photos/remix", json={"image_data_url": PHOTO_DATA_URL, **body})
    assert response.status_code == 422


def test_remix_without_provider_is_503(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/profile-photos/remix", json={"image_data_url": PHOTO_DATA_URL, "style": "cartoon"})
    assert response.status_code == 503
