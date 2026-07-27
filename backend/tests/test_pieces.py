"""Piece API tests — HANDOFF.md §4: a piece and its child records (illustrations,
revision passes, remixes, turns) persist, and lifecycle events append."""

from sqlmodel import Session, select

from app.db import engine
from app.main import app
from app.models.enums import EventType
from app.models.event import Event
from app.models.piece import Illustration
from app.services.image_generation import GeneratedImage, get_image_generator


def _event_count(profile_id: int, event_type: EventType) -> int:
    with Session(engine) as session:
        rows = session.exec(
            select(Event).where(Event.profile_id == profile_id, Event.event_type == event_type)
        ).all()
        return len(rows)


def _post_piece(client, **overrides) -> dict:
    payload = {"profile_id": 1, "game_id": "prompt_forge", "body": "Once upon a time"}
    payload.update(overrides)
    response = client.post("/api/pieces", json=payload)
    assert response.status_code == 201
    return response.json()


def test_piece_for_unknown_profile_is_rejected(client):
    response = client.post("/api/pieces", json={"profile_id": 999, "game_id": "prompt_forge", "body": "hi"})

    assert response.status_code == 404


def test_creating_a_piece_computes_word_count_and_appends_one_event(client):
    before = _event_count(profile_id=1, event_type=EventType.PIECE_CREATED)

    piece = _post_piece(client, body="Once upon a time there was a fox")

    assert piece["word_count"] == 8
    assert piece["revised_at"] is None
    after = _event_count(profile_id=1, event_type=EventType.PIECE_CREATED)
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

    response = client.get("/api/pieces", params={"profile_id": 1})

    assert response.status_code == 200
    assert all(p["profile_id"] == 1 for p in response.json())


def test_patch_piece_recomputes_word_count_and_sets_revised_at(client):
    piece = _post_piece(client, body="one two three")
    before = _event_count(profile_id=1, event_type=EventType.PIECE_REVISED)

    response = client.patch(f"/api/pieces/{piece['id']}", json={"body": "one two three four five"})

    assert response.status_code == 200
    body = response.json()
    assert body["word_count"] == 5
    assert body["revised_at"] is not None
    after = _event_count(profile_id=1, event_type=EventType.PIECE_REVISED)
    assert after - before == 1


def test_illustration_lifecycle(client):
    piece = _post_piece(client)
    before = _event_count(profile_id=1, event_type=EventType.ILLUSTRATION_ADDED)

    response = client.post(
        f"/api/pieces/{piece['id']}/illustrations",
        json={"prompt_excerpt": "a fox in the woods", "image_url": "https://example.com/fox.png", "is_hero": True},
    )

    assert response.status_code == 201
    assert response.json()["piece_id"] == piece["id"]
    after = _event_count(profile_id=1, event_type=EventType.ILLUSTRATION_ADDED)
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
    before = _event_count(profile_id=1, event_type=EventType.PIECE_DELETED)

    response = client.delete(f"/api/pieces/{piece['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/pieces/{piece['id']}").status_code == 404
    after = _event_count(profile_id=1, event_type=EventType.PIECE_DELETED)
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
