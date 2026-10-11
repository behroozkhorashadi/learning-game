"""Piece API tests — HANDOFF.md §4: a piece and its child records (illustrations,
revision passes, remixes, turns) persist, and lifecycle events append."""

import pytest
from sqlmodel import Session, select

from app.db import engine
from app.main import app
from app.models.enums import EventType
from app.models.event import Event
from app.models.piece import Illustration
from app.services.image_generation import GeneratedImage, get_image_generator


_OWN_PROFILE: dict[str, int] = {}


@pytest.fixture(scope="module", autouse=True)
def _own_profile(client):
    """This module's own profile, so it never depends on the seeded demo profile (id 1),
    which is removed as soon as any other test creates a real profile."""
    response = client.post("/api/profiles", json={"name": "Piece Tester", "avatar": "fox", "birth_year": 2018})
    assert response.status_code == 201
    _OWN_PROFILE["id"] = response.json()["id"]


def _pid() -> int:
    return _OWN_PROFILE["id"]


def _event_count(profile_id: int, event_type: EventType) -> int:
    with Session(engine) as session:
        rows = session.exec(
            select(Event).where(Event.profile_id == profile_id, Event.event_type == event_type)
        ).all()
        return len(rows)


def _post_piece(client, **overrides) -> dict:
    payload = {"profile_id": _pid(), "game_id": "prompt_forge", "body": "Once upon a time"}
    payload.update(overrides)
    response = client.post("/api/pieces", json=payload)
    assert response.status_code == 201
    return response.json()


def test_piece_for_unknown_profile_is_rejected(client):
    response = client.post("/api/pieces", json={"profile_id": 999, "game_id": "prompt_forge", "body": "hi"})

    assert response.status_code == 404


def test_creating_a_piece_computes_word_count_and_appends_one_event(client):
    before = _event_count(profile_id=_pid(), event_type=EventType.PIECE_CREATED)

    piece = _post_piece(client, body="Once upon a time there was a fox")

    assert piece["word_count"] == 8
    assert piece["revised_at"] is None
    after = _event_count(profile_id=_pid(), event_type=EventType.PIECE_CREATED)
    assert after - before == 1


def test_get_piece_round_trips(client):
    piece = _post_piece(client)

    response = client.get(f"/api/pieces/{piece['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == piece["id"]


def test_get_unknown_piece_is_404(client):
    response = client.get("/api/pieces/does-not-exist")

    assert response.status_code == 404


def test_list_pieces_filters_by_profile(client):
    _post_piece(client)

    response = client.get("/api/pieces", params={"profile_id": _pid()})

    assert response.status_code == 200
    assert all(p["profile_id"] == _pid() for p in response.json())


def test_patch_piece_recomputes_word_count_and_sets_revised_at(client):
    piece = _post_piece(client, body="one two three")
    before = _event_count(profile_id=_pid(), event_type=EventType.PIECE_REVISED)

    response = client.patch(f"/api/pieces/{piece['id']}", json={"body": "one two three four five"})

    assert response.status_code == 200
    body = response.json()
    assert body["word_count"] == 5
    assert body["revised_at"] is not None
    after = _event_count(profile_id=_pid(), event_type=EventType.PIECE_REVISED)
    assert after - before == 1


def test_illustration_lifecycle(client):
    piece = _post_piece(client)
    before = _event_count(profile_id=_pid(), event_type=EventType.ILLUSTRATION_ADDED)

    response = client.post(
        f"/api/pieces/{piece['id']}/illustrations",
        json={"prompt_excerpt": "a fox in the woods", "image_url": "https://example.com/fox.png", "is_hero": True},
    )

    assert response.status_code == 201
    assert response.json()["piece_id"] == piece["id"]
    after = _event_count(profile_id=_pid(), event_type=EventType.ILLUSTRATION_ADDED)
    assert after - before == 1

    listed = client.get(f"/api/pieces/{piece['id']}/illustrations")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


class _FakeGenerator:
    def __init__(self, image):
        self._image = image

    def generate(self, prompt: str, style):
        return self._image


def test_generate_illustration_saves_the_image_and_records_its_url(client, tmp_path, monkeypatch):
    import app.services.image_generation as image_generation

    monkeypatch.setattr(image_generation, "ILLUSTRATIONS_DIR", tmp_path)
    app.dependency_overrides[get_image_generator] = lambda: _FakeGenerator(GeneratedImage(content=b"fake-png-bytes"))
    try:
        piece = _post_piece(client)

        response = client.post(
            f"/api/pieces/{piece['id']}/illustrations/generate",
            json={"prompt_excerpt": "a fox in the woods", "is_hero": True},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["image_url"].startswith(f"/static/illustrations/{piece['id']}/")

        saved = list((tmp_path / piece["id"]).glob("*.png"))
        assert len(saved) == 1
        assert saved[0].read_bytes() == b"fake-png-bytes"
    finally:
        app.dependency_overrides.pop(get_image_generator, None)


def test_generate_illustration_falls_back_to_empty_url_when_generator_has_nothing(client):
    app.dependency_overrides[get_image_generator] = lambda: _FakeGenerator(None)
    try:
        piece = _post_piece(client)

        response = client.post(
            f"/api/pieces/{piece['id']}/illustrations/generate",
            json={"prompt_excerpt": "a fox in the woods"},
        )

        assert response.status_code == 201
        assert response.json()["image_url"] == ""
    finally:
        app.dependency_overrides.pop(get_image_generator, None)


def test_generate_illustration_for_unknown_piece_is_404(client):
    app.dependency_overrides[get_image_generator] = lambda: _FakeGenerator(None)
    try:
        response = client.post(
            "/api/pieces/does-not-exist/illustrations/generate",
            json={"prompt_excerpt": "a fox in the woods"},
        )

        assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_image_generator, None)


def test_revision_pass_records_whether_anything_changed(client):
    piece = _post_piece(client)

    response = client.post(
        f"/api/pieces/{piece['id']}/revisions",
        json={"questions_asked": ["How did the fox feel?"], "changed": True},
    )

    assert response.status_code == 201
    assert response.json()["changed"] is True


def test_remix_version_for_unknown_piece_is_404(client):
    response = client.post(
        "/api/pieces/does-not-exist/remixes",
        json={"style_key": "spooky", "body": "..."},
    )

    assert response.status_code == 404


def test_turn_line_appends_kid_or_ai_authored_line(client):
    piece = _post_piece(client, game_id="tag_team_story")

    response = client.post(
        f"/api/pieces/{piece['id']}/turns",
        json={"author": "ai", "text": "And then the door creaked open.", "order": 1},
    )

    assert response.status_code == 201
    assert response.json()["author"] == "ai"


def test_delete_piece_removes_it_and_appends_one_event(client):
    piece = _post_piece(client)
    before = _event_count(profile_id=_pid(), event_type=EventType.PIECE_DELETED)

    response = client.delete(f"/api/pieces/{piece['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/pieces/{piece['id']}").status_code == 404
    after = _event_count(profile_id=_pid(), event_type=EventType.PIECE_DELETED)
    assert after - before == 1


def test_delete_piece_also_removes_its_child_rows(client):
    piece = _post_piece(client)
    client.post(
        f"/api/pieces/{piece['id']}/illustrations",
        json={"prompt_excerpt": "a fox in the woods", "image_url": "https://example.com/fox.png", "is_hero": True},
    )
    client.post(
        f"/api/pieces/{piece['id']}/revisions",
        json={"questions_asked": ["How did the fox feel?"], "changed": True},
    )

    response = client.delete(f"/api/pieces/{piece['id']}")

    assert response.status_code == 204
    with Session(engine) as session:
        remaining = session.exec(select(Illustration).where(Illustration.piece_id == piece["id"])).all()
        assert remaining == []


def test_delete_unknown_piece_is_404(client):
    response = client.delete("/api/pieces/does-not-exist")

    assert response.status_code == 404


# --- items/next under a practice config (moves to tests/play/ when play migrates; kept after the
# pieces tests so profile 1's shared history is untouched until test_badges has run) ---

PRACTICE_GAME_ID = "fact_fluency"


def _create_practice_profile(client) -> int:
    from datetime import date

    payload = {"name": "Practice Kid", "avatar": "owl", "birth_year": date.today().year - 9}
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201
    return response.json()["id"]


def _upsert(client, profile_id, **overrides):
    payload = {"profile_id": profile_id, "game_id": PRACTICE_GAME_ID, "operations": ["+", "-"], "focus_numbers": {}, "difficulty": 5}
    payload.update(overrides)
    return client.put("/api/practice-config", json=payload)


def test_items_next_respects_an_active_practice_config(client):
    profile_id = _create_practice_profile(client)
    _upsert(client, profile_id, operations=["+"], focus_numbers={}, difficulty=2)

    for _ in range(30):
        response = client.get(f"/api/items/next?profile_id={profile_id}&game_id={PRACTICE_GAME_ID}")
        assert response.status_code == 200
        assert response.json()["payload"]["operator"] == "+"


def test_items_next_falls_back_to_adaptive_level_with_no_config(client):
    profile_id = _create_practice_profile(client)
    response = client.get(f"/api/items/next?profile_id={profile_id}&game_id={PRACTICE_GAME_ID}")
    assert response.status_code == 200


# --- the profile-delete cascade into legacy tables (moves with pieces/play) ---

from app.composition.app_settings_assembly import load_settings as _load_settings

CASCADE_ADMIN = {"X-Admin-Password": _load_settings().admin_password.get_secret_value()}


def _cascade_profile(client) -> int:
    from datetime import date

    response = client.post("/api/profiles", json={"name": "Cascade Kid", "avatar": "owl", "birth_year": date.today().year - 7})
    assert response.status_code == 201
    return response.json()["id"]


def test_delete_profile_also_removes_its_dependent_rows(client):
    pid = _cascade_profile(client)

    piece = client.post("/api/pieces", json={"profile_id": pid, "game_id": "prompt_forge", "body": "hi"}).json()
    client.post(
        "/api/pieces/{}/illustrations".format(piece["id"]),
        json={"prompt_excerpt": "hi", "image_url": "http://example.com/x.png"},
    )
    client.post("/api/ratings", json={"profile_id": pid, "game_id": "prompt_forge", "scale": "stars_1_5", "value": 5})

    assert client.delete(f"/api/profiles/{pid}", headers=CASCADE_ADMIN).status_code == 204
    assert client.get(f"/api/pieces/{piece['id']}").status_code == 404


def _pathfinder_map(map_id):
    return {
        "id": map_id,
        "name": "Kid_map1",
        "difficulty": "easy",
        "rows": 2,
        "columns": 2,
        "dots": [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 1}],
    }


def test_deleting_a_profile_removes_its_pathfinder_state(client):
    profile_id = _cascade_profile(client)
    client.post(f"/api/profiles/{profile_id}/pathfinder/completions", json={"level_ids": ["easy-a"]})
    client.post(f"/api/profiles/{profile_id}/pathfinder/maps", json=_pathfinder_map("custom-gone"))

    assert client.delete(f"/api/profiles/{profile_id}", headers=CASCADE_ADMIN).status_code == 204

    # The map id is free again, so its row really was removed.
    new_id = _cascade_profile(client)
    assert client.post(f"/api/profiles/{new_id}/pathfinder/maps", json=_pathfinder_map("custom-gone")).status_code == 201
