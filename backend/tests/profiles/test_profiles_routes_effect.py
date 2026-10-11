"""The profile endpoints over HTTP: create, list, unlock, edit, saved pictures, the
remix preview, and the admin-only delete. Real SQL repository and picture files under
tmp_path; the remixer, clock, salts, admin check, and cross-feature erase are fakes."""

import base64
from collections.abc import Mapping
from pathlib import Path
from types import MappingProxyType

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.profiles.photo_remix_service_effect import make_photo_remix_service
from app.profiles.profiles_routes_effect import bind_profiles_routes
from tests.profiles.profiles_fakes import (
    ADMIN_PASSWORD,
    PHOTO_DATA_URL,
    YEAR,
    FakeRemixer,
    Harness,
    files,
    harness,
    photo,
)

ADMIN = MappingProxyType({"X-Admin-Password": ADMIN_PASSWORD})


@pytest.fixture
def setup(tmp_path: Path) -> Harness:
    return harness(tmp_path)


@pytest.fixture
def remixer() -> FakeRemixer:
    return FakeRemixer()


@pytest.fixture
def client(setup: Harness, remixer: FakeRemixer) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_profiles_routes(service=setup.service, remix=make_photo_remix_service(remixer=remixer)))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


@pytest.fixture
def avatars(tmp_path: Path) -> Path:
    return tmp_path / "avatars"


def create(client: httpx.Client, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {"name": "Test Kid", "avatar": "owl", "birth_year": YEAR - 7}
    body.update(overrides)
    response = client.post("/api/profiles", json=body)
    assert response.status_code == 201, response.text
    created: dict[str, object] = response.json()
    return created


def photos(
    client: httpx.Client, profile_id: object, headers: Mapping[str, str] | None = None
) -> list[dict[str, object]]:
    response = client.get(f"/api/profiles/{profile_id}/photos", headers=headers or {})
    assert response.status_code == 200, response.text
    listed: list[dict[str, object]] = response.json()
    return listed


def listed(client: httpx.Client, profile_id: object) -> dict[str, object]:
    return next(p for p in client.get("/api/profiles").json() if p["id"] == profile_id)


# --- create and list ---


def test_create_profile_round_trips(client: httpx.Client) -> None:
    body = create(client, name="Timmy", birth_year=YEAR - 7, reading_support=True)
    assert body == {
        "id": 1,
        "name": "Timmy",
        "avatar": "owl",
        "birth_year": YEAR - 7,
        "reading_support": True,
        "created_at": "2026-10-07T12:00:00",
        "has_password": False,
    }
    assert listed(client, 1) == body


def test_create_profile_trims_whitespace_from_name(client: httpx.Client) -> None:
    assert create(client, name="  Sam  ")["name"] == "Sam"


@pytest.mark.parametrize(
    ("overrides", "detail"),
    [
        ({"name": "   "}, "name must not be blank"),
        ({"avatar": "dragon"}, "avatar must be one of ['fox', 'owl', 'bear', 'cat', 'panda', 'rabbit']"),
        ({"birth_year": YEAR - 100}, "birth_year implies an age outside 1-99"),
        ({"birth_year": YEAR + 1}, "birth_year implies an age outside 1-99"),
        ({"password": "abc"}, "password must be 4-128 characters"),
    ],
)
def test_create_profile_rejects_bad_input(client: httpx.Client, overrides: dict[str, object], detail: str) -> None:
    body = {"name": "Ada", "avatar": "fox", "birth_year": YEAR - 6, **overrides}
    response = client.post("/api/profiles", json=body)
    assert (response.status_code, response.json()) == (422, {"detail": detail})


def test_creating_a_real_profile_removes_the_demo(client: httpx.Client, setup: Harness) -> None:
    setup.service.seed(None)
    assert [p["name"] for p in client.get("/api/profiles").json()] == ["Demo Kid"]
    create(client, name="Real Kid")
    assert [p["name"] for p in client.get("/api/profiles").json()] == ["Real Kid"]
    assert setup.erased.erased == [1]


# --- passwords ---


def test_profile_password_is_never_returned(client: httpx.Client) -> None:
    profile = create(client, password="tiger42")
    assert profile["has_password"] is True
    assert not any("hash" in key or key == "password" for key in profile)
    shown = listed(client, profile["id"])
    assert shown["has_password"] is True
    assert not any("hash" in key or key == "password" for key in shown)


@pytest.mark.parametrize(
    ("password", "expected"),
    [("tiger42", 204), ("wrong", 401), ("", 401), (ADMIN_PASSWORD, 204)],
)
def test_unlock_accepts_profile_password_or_admin_override(client: httpx.Client, password: str, expected: int) -> None:
    profile = create(client, password="tiger42")
    response = client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": password})
    assert response.status_code == expected
    if expected == 401:
        assert response.json() == {"detail": "wrong password for this profile"}


def test_unlock_unprotected_profile_always_succeeds_and_unknown_is_404(client: httpx.Client) -> None:
    profile = create(client)
    assert client.post(f"/api/profiles/{profile['id']}/unlock", json={"password": ""}).status_code == 204
    missing = client.post("/api/profiles/999999/unlock", json={"password": ""})
    assert (missing.status_code, missing.json()) == (404, {"detail": "no profile with id 999999"})


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({}, 401),
        ({"X-Profile-Password": "wrong"}, 401),
        ({"X-Profile-Password": "tiger42"}, 200),
        ({"X-Profile-Password": ADMIN_PASSWORD}, 200),
        ({"X-Admin-Password": ADMIN_PASSWORD}, 200),
        ({"X-Admin-Password": "wrong"}, 401),
    ],
)
def test_patch_protected_profile_needs_its_password_or_admin(
    client: httpx.Client, headers: dict[str, str], expected: int
) -> None:
    profile = create(client, password="tiger42")
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed"}, headers=headers)
    assert response.status_code == expected


def test_change_and_remove_profile_password(client: httpx.Client) -> None:
    profile = create(client, password="tiger42")
    url = f"/api/profiles/{profile['id']}"

    changed = client.patch(url, json={"password": "lion99"}, headers={"X-Profile-Password": "tiger42"})
    assert changed.status_code == 200
    assert changed.json()["has_password"] is True
    assert client.post(f"{url}/unlock", json={"password": "tiger42"}).status_code == 401
    assert client.post(f"{url}/unlock", json={"password": "lion99"}).status_code == 204

    # Forgotten password: the admin override can clear it.
    removed = client.patch(url, json={"remove_password": True}, headers=ADMIN)
    assert removed.status_code == 200
    assert removed.json()["has_password"] is False
    assert client.patch(url, json={"name": "Open again"}).status_code == 200


def test_patch_rejects_setting_and_removing_password_together(client: httpx.Client) -> None:
    profile = create(client)
    response = client.patch(f"/api/profiles/{profile['id']}", json={"password": "lion99", "remove_password": True})
    assert (response.status_code, response.json()) == (
        422,
        {"detail": "send either password or remove_password, not both"},
    )


def test_patch_rejects_bad_new_password_without_changing_anything(client: httpx.Client) -> None:
    profile = create(client, name="Before")
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "After", "password": "ab"})
    assert response.status_code == 422
    shown = listed(client, profile["id"])
    assert (shown["name"], shown["has_password"]) == ("Before", False)


# --- edits ---


def test_patch_profile_updates_only_provided_fields(client: httpx.Client) -> None:
    profile = create(client, name="Original", avatar="fox")
    body = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed"}, headers=ADMIN).json()
    assert (body["name"], body["avatar"]) == ("Renamed", "fox")


def test_patch_profile_rejects_invalid_avatar_and_unknown_profile(client: httpx.Client) -> None:
    profile = create(client)
    assert client.patch(f"/api/profiles/{profile['id']}", json={"avatar": "dragon"}).status_code == 422
    assert client.patch("/api/profiles/999999", json={"name": "X"}, headers=ADMIN).status_code == 404


# --- delete ---


def test_delete_profile_needs_the_admin_password(client: httpx.Client) -> None:
    profile = create(client)
    for headers in ({}, {"X-Admin-Password": "wrong"}):
        response = client.delete(f"/api/profiles/{profile['id']}", headers=headers)
        assert (response.status_code, response.json()) == (401, {"detail": "invalid admin password"})
    # The admin check runs first, even for a profile that doesn't exist.
    assert client.delete("/api/profiles/999999").status_code == 401


def test_delete_profile_removes_it_its_password_and_other_features_data(client: httpx.Client, setup: Harness) -> None:
    profile = create(client, password="tiger42")
    assert client.delete(f"/api/profiles/{profile['id']}", headers=ADMIN).status_code == 204
    assert all(p["id"] != profile["id"] for p in client.get("/api/profiles").json())
    assert setup.repository.password_hash(1) is None
    assert setup.erased.erased == [1]


def test_delete_unknown_profile_is_404(client: httpx.Client) -> None:
    assert client.delete("/api/profiles/999999", headers=ADMIN).status_code == 404


# --- saved pictures ---


def test_create_profile_saves_every_variant_and_uses_the_picked_one(client: httpx.Client, avatars: Path) -> None:
    profile = create(client, new_photos=[photo("Original"), photo("Wizard", use=True), photo("Pixel art")])
    saved = photos(client, profile["id"])
    assert [p["label"] for p in saved] == ["Original", "Wizard", "Pixel art"]
    assert profile["avatar"] == saved[1]["url"] == "/static/profile-avatars/photo2.png"
    assert files(avatars) == ["photo1.png", "photo2.png", "photo3.png"]


def test_create_profile_with_photos_but_none_picked_keeps_the_animal(client: httpx.Client) -> None:
    profile = create(client, avatar="owl", new_photos=[photo("Original")])
    assert profile["avatar"] == "owl"
    assert len(photos(client, profile["id"])) == 1


def test_switching_between_saved_photos_and_animals_keeps_every_photo(client: httpx.Client, avatars: Path) -> None:
    profile = create(client, new_photos=[photo("Original", use=True), photo("Cartoon")])
    url = f"/api/profiles/{profile['id']}"
    original, cartoon = photos(client, profile["id"])

    assert client.patch(url, json={"avatar": cartoon["url"]}).json()["avatar"] == cartoon["url"]
    assert client.patch(url, json={"avatar": "panda"}).json()["avatar"] == "panda"
    assert client.patch(url, json={"avatar": original["url"]}).json()["avatar"] == original["url"]
    assert len(files(avatars)) == 2


def test_patch_adds_new_variants_to_the_saved_list(client: httpx.Client) -> None:
    profile = create(client, new_photos=[photo("Original", use=True)])
    response = client.patch(
        f"/api/profiles/{profile['id']}", json={"new_photos": [photo("Retake"), photo("Space explorer", use=True)]}
    )
    assert response.status_code == 200
    saved = photos(client, profile["id"])
    assert [p["label"] for p in saved] == ["Original", "Retake", "Space explorer"]
    assert response.json()["avatar"] == saved[2]["url"]


def test_patch_keeps_current_photo_when_resent(client: httpx.Client) -> None:
    """The edit screen sends the current avatar back unchanged when only the name
    changes: a saved photo's /static path must not fail validation."""
    profile = create(client, new_photos=[photo(use=True)])
    response = client.patch(f"/api/profiles/{profile['id']}", json={"name": "Renamed", "avatar": profile["avatar"]})
    assert (response.status_code, response.json()["avatar"]) == (200, profile["avatar"])


def test_cannot_use_another_profiles_photo(client: httpx.Client) -> None:
    owner = create(client, new_photos=[photo(use=True)])
    other = create(client, name="Other")
    assert client.patch(f"/api/profiles/{other['id']}", json={"avatar": owner["avatar"]}).status_code == 422


@pytest.mark.parametrize(
    ("new_photos", "detail"),
    [
        ([photo(use=True), photo(use=True)], "at most one new photo can be the avatar"),
        ([photo(data_url="data:image/gif;base64,AAAA")], "avatar photo must be a base64 PNG or JPEG data URL"),
        ([photo(data_url="data:image/png;base64,")], "avatar photo must be between 1 byte and 5 MB"),
        ([photo(label="   ")], "photo label must be 1-80 characters"),
        ([photo()] * 13, "at most 12 photos per save"),
    ],
)
def test_bad_new_photos_are_rejected_without_writing_files(
    client: httpx.Client, avatars: Path, new_photos: list[dict[str, object]], detail: str
) -> None:
    body = {"name": "Ada", "avatar": "fox", "birth_year": YEAR - 6, "new_photos": new_photos}
    response = client.post("/api/profiles", json=body)
    assert (response.status_code, response.json()) == (422, {"detail": detail})
    assert files(avatars) == []


def test_delete_saved_photo_but_not_the_current_one(client: httpx.Client, avatars: Path) -> None:
    profile = create(client, new_photos=[photo("Original", use=True), photo("Cartoon")])
    original, cartoon = photos(client, profile["id"])
    base = f"/api/profiles/{profile['id']}/photos"

    current = client.delete(f"{base}/{original['id']}")
    assert current.status_code == 409
    assert current.json() == {"detail": "that's the current profile picture — switch to another one first"}
    assert client.delete(f"{base}/{cartoon['id']}").status_code == 204
    assert [p["id"] for p in photos(client, profile["id"])] == [original["id"]]
    assert len(files(avatars)) == 1
    gone = client.delete(f"{base}/{cartoon['id']}")
    assert (gone.status_code, gone.json()) == (404, {"detail": f"no photo {cartoon['id']} on profile {profile['id']}"})


def test_saved_photos_follow_the_profile_password(client: httpx.Client) -> None:
    profile = create(client, password="tiger42", new_photos=[photo(use=True), photo("Cartoon")])
    base = f"/api/profiles/{profile['id']}/photos"

    assert client.get(base).status_code == 401
    assert len(photos(client, profile["id"], {"X-Profile-Password": "tiger42"})) == 2
    assert len(photos(client, profile["id"], ADMIN)) == 2
    cartoon_id = photos(client, profile["id"], {"X-Profile-Password": "tiger42"})[1]["id"]
    assert client.delete(f"{base}/{cartoon_id}").status_code == 401


def test_photos_of_another_profile_cannot_be_deleted_through_this_one(client: httpx.Client) -> None:
    owner = create(client, new_photos=[photo(use=True), photo("Cartoon")])
    other = create(client, name="Other")
    cartoon_id = photos(client, owner["id"])[1]["id"]
    assert client.delete(f"/api/profiles/{other['id']}/photos/{cartoon_id}").status_code == 404


def test_deleting_a_profile_removes_all_its_photos(client: httpx.Client, avatars: Path) -> None:
    profile = create(client, new_photos=[photo(use=True), photo("Cartoon")])
    assert client.delete(f"/api/profiles/{profile['id']}", headers=ADMIN).status_code == 204
    assert files(avatars) == []


# --- remix preview ---


def test_remix_returns_preview_without_saving(client: httpx.Client, remixer: FakeRemixer, avatars: Path) -> None:
    body = {"image_data_url": PHOTO_DATA_URL, "style": "wizard", "idea": "rainbow hair"}
    response = client.post("/api/profile-photos/remix", json=body)
    assert response.status_code == 200
    assert response.json() == {"image_data_url": "data:image/jpeg;base64," + base64.b64encode(b"remixed").decode()}
    assert len(remixer.prompts) == 1
    assert "a friendly young wizard" in remixer.prompts[0]
    assert "Fun extra details they asked for: rainbow hair." in remixer.prompts[0]
    assert files(avatars) == []


@pytest.mark.parametrize(
    ("body", "detail"),
    [
        (
            {"style": "not-a-style"},
            "style must be one of ['cartoon', 'pixel', 'space', 'storybook', 'superhero', 'underwater', "
            "'watercolor', 'wizard']",
        ),
        ({"idea": "x" * 121}, "idea must be at most 120 characters"),
        ({}, "pick a style or type an idea to remix the photo"),
        ({"idea": "   "}, "pick a style or type an idea to remix the photo"),
    ],
)
def test_remix_rejects_bad_input(client: httpx.Client, body: dict[str, object], detail: str) -> None:
    response = client.post("/api/profile-photos/remix", json={"image_data_url": PHOTO_DATA_URL, **body})
    assert (response.status_code, response.json()) == (422, {"detail": detail})


def test_remix_without_provider_is_503(client: httpx.Client, remixer: FakeRemixer) -> None:
    remixer.result = None
    response = client.post("/api/profile-photos/remix", json={"image_data_url": PHOTO_DATA_URL, "style": "cartoon"})
    assert (response.status_code, response.json()) == (503, {"detail": "AI photo remix isn't available right now"})
