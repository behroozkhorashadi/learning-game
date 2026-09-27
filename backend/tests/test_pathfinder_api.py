"""Per-profile Pathfinder state: finished curated levels and saved custom
maps, both stored server-side so they follow the profile across browsers."""

from datetime import date

ADMIN_HEADERS = {"X-Admin-Password": "test-admin-password"}


def _create_profile(client, name="Path Kid") -> int:
    payload = {"name": name, "avatar": "owl", "birth_year": date.today().year - 9}
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def _map_payload(map_id="custom-abc", **overrides):
    payload = {
        "id": map_id,
        "name": "Kid_map1",
        "difficulty": "easy",
        "rows": 2,
        "columns": 2,
        "dots": [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 1}],
    }
    payload.update(overrides)
    return payload


def test_completions_start_empty(client):
    profile_id = _create_profile(client)
    response = client.get(f"/api/profiles/{profile_id}/pathfinder/completions")
    assert response.status_code == 200
    assert response.json() == []


def test_completions_are_recorded_once_and_scoped_to_the_profile(client):
    profile_id = _create_profile(client)
    other_id = _create_profile(client, "Other Kid")
    url = f"/api/profiles/{profile_id}/pathfinder/completions"

    first = client.post(url, json={"level_ids": ["easy-a", "easy-b"]})
    assert first.status_code == 200
    assert first.json() == ["easy-a", "easy-b"]

    again = client.post(url, json={"level_ids": ["easy-b", "easy-c", "easy-c"]})
    assert again.json() == ["easy-a", "easy-b", "easy-c"]

    assert client.get(f"/api/profiles/{other_id}/pathfinder/completions").json() == []


def test_completions_for_unknown_profile_is_404(client):
    assert client.get("/api/profiles/999999/pathfinder/completions").status_code == 404
    assert client.post("/api/profiles/999999/pathfinder/completions", json={"level_ids": ["x"]}).status_code == 404


def test_map_create_list_round_trip(client):
    profile_id = _create_profile(client)
    url = f"/api/profiles/{profile_id}/pathfinder/maps"

    created = client.post(url, json=_map_payload("custom-rt"))
    assert created.status_code == 201
    body = created.json()
    assert body["id"] == "custom-rt"
    assert body["published"] is False
    assert body["dots"] == [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 1}]

    listed = client.get(url).json()
    assert [m["id"] for m in listed] == ["custom-rt"]


def test_maps_list_newest_first_and_are_scoped_to_the_profile(client):
    profile_id = _create_profile(client)
    other_id = _create_profile(client, "Other Kid")
    url = f"/api/profiles/{profile_id}/pathfinder/maps"
    client.post(url, json=_map_payload("custom-old"))
    client.post(url, json=_map_payload("custom-new"))

    assert [m["id"] for m in client.get(url).json()] == ["custom-new", "custom-old"]
    assert client.get(f"/api/profiles/{other_id}/pathfinder/maps").json() == []


def test_map_create_rejects_bad_input(client):
    profile_id = _create_profile(client)
    url = f"/api/profiles/{profile_id}/pathfinder/maps"
    assert client.post(url, json=_map_payload("custom-bad1", difficulty="impossible")).status_code == 422
    assert client.post(url, json=_map_payload("custom-bad2", name="   ")).status_code == 422
    assert client.post(url, json=_map_payload("custom-bad3", dots=[])).status_code == 422

    assert client.post(url, json=_map_payload("custom-dup")).status_code == 201
    assert client.post(url, json=_map_payload("custom-dup")).status_code == 409


def test_map_rename_and_publish_keep_identity(client):
    profile_id = _create_profile(client)
    url = f"/api/profiles/{profile_id}/pathfinder/maps"
    created = client.post(url, json=_map_payload("custom-edit")).json()

    renamed = client.patch(f"{url}/custom-edit", json={"name": "Spiral"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Spiral"
    assert renamed.json()["created_at"] == created["created_at"]

    published = client.patch(f"{url}/custom-edit", json={"published": True})
    assert published.json()["published"] is True
    assert published.json()["name"] == "Spiral"

    assert client.patch(f"{url}/custom-edit", json={"name": " "}).status_code == 422


def test_map_delete(client):
    profile_id = _create_profile(client)
    url = f"/api/profiles/{profile_id}/pathfinder/maps"
    client.post(url, json=_map_payload("custom-del"))

    assert client.delete(f"{url}/custom-del").status_code == 204
    assert client.get(url).json() == []
    assert client.delete(f"{url}/custom-del").status_code == 404


def test_one_profile_cannot_touch_another_profiles_map(client):
    owner_id = _create_profile(client)
    other_id = _create_profile(client, "Other Kid")
    client.post(f"/api/profiles/{owner_id}/pathfinder/maps", json=_map_payload("custom-owned"))

    other_url = f"/api/profiles/{other_id}/pathfinder/maps/custom-owned"
    assert client.patch(other_url, json={"name": "Mine now"}).status_code == 404
    assert client.delete(other_url).status_code == 404


def test_deleting_a_profile_removes_its_pathfinder_state(client):
    profile_id = _create_profile(client)
    client.post(f"/api/profiles/{profile_id}/pathfinder/completions", json={"level_ids": ["easy-a"]})
    client.post(f"/api/profiles/{profile_id}/pathfinder/maps", json=_map_payload("custom-gone"))

    assert client.delete(f"/api/profiles/{profile_id}", headers=ADMIN_HEADERS).status_code == 204

    # The map id is free again, so its row really was removed.
    new_id = _create_profile(client)
    assert client.post(f"/api/profiles/{new_id}/pathfinder/maps", json=_map_payload("custom-gone")).status_code == 201


def test_published_maps_lists_every_profiles_published_maps_with_author(client):
    maker_id = _create_profile(client, "Maker")
    other_id = _create_profile(client, "Other")
    maker_url = f"/api/profiles/{maker_id}/pathfinder/maps"
    client.post(maker_url, json=_map_payload("custom-pub", name="Shared"))
    client.post(maker_url, json=_map_payload("custom-private", name="Secret"))
    client.post(f"/api/profiles/{other_id}/pathfinder/maps", json=_map_payload("custom-other", name="Theirs"))
    client.patch(f"{maker_url}/custom-pub", json={"published": True})
    client.patch(f"/api/profiles/{other_id}/pathfinder/maps/custom-other", json={"published": True})

    response = client.get("/api/pathfinder/published-maps")
    assert response.status_code == 200
    by_id = {row["id"]: row for row in response.json()}
    assert "custom-private" not in by_id
    assert by_id["custom-pub"]["author_name"] == "Maker"
    assert by_id["custom-pub"]["author_profile_id"] == maker_id
    assert by_id["custom-pub"]["dots"] == _map_payload()["dots"]
    assert by_id["custom-other"]["author_name"] == "Other"


def test_unpublished_map_drops_out_of_published_maps(client):
    profile_id = _create_profile(client)
    url = f"/api/profiles/{profile_id}/pathfinder/maps"
    client.post(url, json=_map_payload("custom-unpub"))
    client.patch(f"{url}/custom-unpub", json={"published": True})
    assert "custom-unpub" in [row["id"] for row in client.get("/api/pathfinder/published-maps").json()]

    client.patch(f"{url}/custom-unpub", json={"published": False})
    assert "custom-unpub" not in [row["id"] for row in client.get("/api/pathfinder/published-maps").json()]
