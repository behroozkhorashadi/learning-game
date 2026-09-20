"""GET/PUT/DELETE /api/practice-config — the practice-settings screen's
backing endpoints (e.g. Equation Outbreak's operations/focus-numbers/
difficulty override). No admin auth — a practice preference, not a
destructive action."""

from datetime import date

GAME_ID = "fact_fluency"


def _create_profile(client) -> int:
    payload = {"name": "Practice Kid", "avatar": "owl", "birth_year": date.today().year - 9}
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def _upsert(client, profile_id, **overrides):
    payload = {"profile_id": profile_id, "game_id": GAME_ID, "operations": ["+", "-"], "focus_numbers": {}, "difficulty": 5}
    payload.update(overrides)
    return client.put("/api/practice-config", json=payload)


def test_get_with_no_config_is_404(client):
    profile_id = _create_profile(client)
    response = client.get(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert response.status_code == 404


def test_put_then_get_round_trips(client):
    profile_id = _create_profile(client)
    put_response = _upsert(client, profile_id, operations=["×", "÷"], focus_numbers={"×": [7, 8]}, difficulty=8)
    assert put_response.status_code == 200
    body = put_response.json()
    assert body["operations"] == ["×", "÷"]
    assert body["focus_numbers"] == {"×": [7, 8]}
    assert body["difficulty"] == 8

    get_response = client.get(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert get_response.status_code == 200
    assert get_response.json()["difficulty"] == 8


def test_put_again_updates_in_place_not_a_duplicate(client):
    profile_id = _create_profile(client)
    _upsert(client, profile_id, difficulty=3)
    _upsert(client, profile_id, difficulty=6)

    get_response = client.get(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert get_response.json()["difficulty"] == 6


def test_delete_reverts_to_no_config(client):
    profile_id = _create_profile(client)
    _upsert(client, profile_id)

    delete_response = client.delete(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert get_response.status_code == 404


def test_delete_with_no_config_is_404(client):
    profile_id = _create_profile(client)
    response = client.delete(f"/api/practice-config?profile_id={profile_id}&game_id={GAME_ID}")
    assert response.status_code == 404


def test_put_rejects_empty_operations(client):
    profile_id = _create_profile(client)
    response = _upsert(client, profile_id, operations=[])
    assert response.status_code == 422


def test_put_rejects_unknown_operation(client):
    profile_id = _create_profile(client)
    response = _upsert(client, profile_id, operations=["%"])
    assert response.status_code == 422


def test_put_rejects_difficulty_out_of_range(client):
    profile_id = _create_profile(client)
    assert _upsert(client, profile_id, difficulty=0).status_code == 422
    assert _upsert(client, profile_id, difficulty=11).status_code == 422


def test_put_rejects_unsupported_game(client):
    profile_id = _create_profile(client)
    response = _upsert(client, profile_id, game_id="syllable_builder")
    assert response.status_code == 422


def test_put_for_unknown_profile_is_404(client):
    response = _upsert(client, 999999)
    assert response.status_code == 404


def test_items_next_respects_an_active_practice_config(client):
    profile_id = _create_profile(client)
    _upsert(client, profile_id, operations=["+"], focus_numbers={}, difficulty=2)

    for _ in range(30):
        response = client.get(f"/api/items/next?profile_id={profile_id}&game_id={GAME_ID}")
        assert response.status_code == 200
        assert response.json()["payload"]["operator"] == "+"


def test_items_next_falls_back_to_adaptive_level_with_no_config(client):
    profile_id = _create_profile(client)
    response = client.get(f"/api/items/next?profile_id={profile_id}&game_id={GAME_ID}")
    assert response.status_code == 200
