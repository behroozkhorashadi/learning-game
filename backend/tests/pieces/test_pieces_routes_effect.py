"""Piece API — HANDOFF.md §4: a piece and its child records (illustrations, revision
passes, remixes, turns) persist, and lifecycle events append."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.pieces.pieces_routes_effect import bind_pieces_routes
from app.pieces.pieces_schemas_pure import GeneratedImage
from tests.pieces.pieces_fakes import PieceHarness, piece_harness


@pytest.fixture
def pieces(tmp_path: Path) -> PieceHarness:
    return piece_harness(tmp_path)


@pytest.fixture
def client(pieces: PieceHarness) -> httpx.Client:
    app = FastAPI()
    app.include_router(bind_pieces_routes(service=pieces.service))
    # Typed as its httpx base class: Starlette's own TestClient annotations don't resolve under pyright.
    return TestClient(app)


def post_piece(client: httpx.Client, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {"profile_id": 1, "game_id": "prompt_forge", "body": "Once upon a time"}
    body.update(overrides)
    response = client.post("/api/pieces", json=body)
    assert response.status_code == 201, response.text
    created: dict[str, object] = response.json()
    return created


def test_piece_for_unknown_profile_is_rejected(client: httpx.Client) -> None:
    response = client.post("/api/pieces", json={"profile_id": 999, "game_id": "prompt_forge", "body": "hi"})
    assert (response.status_code, response.json()) == (404, {"detail": "no profile with id 999"})


def test_creating_a_piece_computes_word_count_appends_one_event_and_reports_it(
    client: httpx.Client, pieces: PieceHarness
) -> None:
    piece = post_piece(client, body="Once upon a time there was a fox", session_id="s1")
    assert piece == {
        "id": "piece-1",
        "profile_id": 1,
        "game_id": "prompt_forge",
        "session_id": "s1",
        "title": None,
        "body": "Once upon a time there was a fox",
        "word_count": 8,
        "constraints": [],
        "art_style": None,
        "created_at": "2026-10-07T12:00:00",
        "revised_at": None,
    }
    assert pieces.events.appended == [("piece_created", {"piece_id": "piece-1", "word_count": 8}, "s1")]
    assert pieces.pieces_reported == [(1, "s1")]


def test_get_list_and_unknown(client: httpx.Client) -> None:
    piece = post_piece(client)
    post_piece(client, game_id="tag_team_story")
    assert client.get(f"/api/pieces/{piece['id']}").json()["id"] == piece["id"]
    missing = client.get("/api/pieces/does-not-exist")
    assert (missing.status_code, missing.json()) == (404, {"detail": "no piece with id does-not-exist"})
    assert len(client.get("/api/pieces", params={"profile_id": 1}).json()) == 2
    filtered = client.get("/api/pieces", params={"profile_id": 1, "game_id": "tag_team_story"}).json()
    assert [p["game_id"] for p in filtered] == ["tag_team_story"]
    assert client.get("/api/pieces", params={"profile_id": 2}).json() == []


def test_patch_piece_recomputes_word_count_and_sets_revised_at(client: httpx.Client, pieces: PieceHarness) -> None:
    piece = post_piece(client, body="one two three")
    response = client.patch(f"/api/pieces/{piece['id']}", json={"body": "one two three four five"})
    assert response.status_code == 200
    body = response.json()
    assert (body["word_count"], body["title"]) == (5, None)
    assert body["revised_at"] is not None
    assert len(pieces.events.of("piece_revised")) == 1
    assert client.patch("/api/pieces/nope", json={"title": "x"}).status_code == 404


def test_illustration_lifecycle(client: httpx.Client, pieces: PieceHarness) -> None:
    piece = post_piece(client)
    response = client.post(
        f"/api/pieces/{piece['id']}/illustrations",
        json={"prompt_excerpt": "a fox in the woods", "image_url": "https://example.com/fox.png", "is_hero": True},
    )
    assert response.status_code == 201
    assert response.json()["piece_id"] == piece["id"]
    assert pieces.events.of("illustration_added") == [{"piece_id": piece["id"], "illustration_id": 1, "is_hero": True}]
    assert len(client.get(f"/api/pieces/{piece['id']}/illustrations").json()) == 1
    assert client.get("/api/pieces/nope/illustrations").status_code == 404


def test_generate_illustration_saves_the_image_and_records_its_url(client: httpx.Client, pieces: PieceHarness) -> None:
    pieces.images.image = GeneratedImage(content=b"fake-png-bytes")
    piece = post_piece(client, art_style="chalk")
    response = client.post(
        f"/api/pieces/{piece['id']}/illustrations/generate",
        json={"prompt_excerpt": "a fox in the woods", "is_hero": True},
    )
    assert response.status_code == 201
    assert response.json()["image_url"] == f"/static/illustrations/{piece['id']}/art1.png"
    assert (pieces.illustrations_dir / str(piece["id"]) / "art1.png").read_bytes() == b"fake-png-bytes"
    assert pieces.images.prompts == [("a fox in the woods", "chalk")]


def test_generate_illustration_falls_back_to_empty_url_when_there_is_no_picture(client: httpx.Client) -> None:
    piece = post_piece(client)
    response = client.post(f"/api/pieces/{piece['id']}/illustrations/generate", json={"prompt_excerpt": "a fox"})
    assert (response.status_code, response.json()["image_url"]) == (201, "")
    assert client.post("/api/pieces/nope/illustrations/generate", json={"prompt_excerpt": "x"}).status_code == 404


def test_revisions_remixes_and_turns(client: httpx.Client) -> None:
    piece = post_piece(client, game_id="tag_team_story")
    revision = client.post(
        f"/api/pieces/{piece['id']}/revisions", json={"questions_asked": ["How did the fox feel?"], "changed": True}
    )
    assert (revision.status_code, revision.json()["changed"]) == (201, True)
    remix = client.post(f"/api/pieces/{piece['id']}/remixes", json={"style_key": "spooky", "body": "..."})
    assert (remix.status_code, remix.json()["is_favourite"]) == (201, False)
    turn = client.post(
        f"/api/pieces/{piece['id']}/turns", json={"author": "ai", "text": "And then the door creaked open.", "order": 1}
    )
    assert (turn.status_code, turn.json()["author"]) == (201, "ai")
    for path in ("revisions", "remixes", "turns"):
        body = {"style_key": "s", "body": "b", "author": "kid", "text": "t"}
        assert client.post(f"/api/pieces/does-not-exist/{path}", json=body).status_code == 404


def test_delete_piece_removes_it_and_its_children_and_appends_one_event(
    client: httpx.Client, pieces: PieceHarness
) -> None:
    piece = post_piece(client)
    client.post(
        f"/api/pieces/{piece['id']}/illustrations",
        json={"prompt_excerpt": "a fox", "image_url": "https://example.com/fox.png"},
    )
    client.post(f"/api/pieces/{piece['id']}/revisions", json={"changed": True})
    assert client.delete(f"/api/pieces/{piece['id']}").status_code == 204
    assert client.get(f"/api/pieces/{piece['id']}").status_code == 404
    assert pieces.repository.illustrations(str(piece["id"])) == ()
    assert pieces.events.of("piece_deleted") == [{"piece_id": piece["id"]}]
    assert client.delete("/api/pieces/does-not-exist").status_code == 404
