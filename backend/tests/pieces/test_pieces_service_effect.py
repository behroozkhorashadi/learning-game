from pathlib import Path

import pytest

from app.pieces.pieces_ports_pure import PieceNotFoundError, ProfileNotFoundError
from app.pieces.pieces_schemas_pure import IllustrationGenerateRequest, PieceCreate, PieceUpdate
from tests.pieces.pieces_fakes import piece_harness


def test_a_piece_and_its_revisions_round_trip(tmp_path: Path) -> None:
    pieces = piece_harness(tmp_path)
    piece = pieces.service.create(PieceCreate(profile_id=1, game_id="prompt_forge", body="a b", constraints=["rhyme"]))
    revised = pieces.service.revise(piece.id, PieceUpdate(title="Fox"))
    assert (revised.title, revised.body, revised.word_count, revised.constraints) == ("Fox", "a b", 2, ["rhyme"])
    assert pieces.service.game_ids_for(1) == ("prompt_forge",)


def test_errors_write_nothing(tmp_path: Path) -> None:
    pieces = piece_harness(tmp_path)
    with pytest.raises(ProfileNotFoundError):
        pieces.service.create(PieceCreate(profile_id=2, game_id="g"))
    with pytest.raises(PieceNotFoundError):
        pieces.service.get("nope")
    assert pieces.events.appended == []
    assert pieces.pieces_reported == []


def test_delete_for_profile_takes_every_piece_and_child(tmp_path: Path) -> None:
    pieces = piece_harness(tmp_path)
    piece = pieces.service.create(PieceCreate(profile_id=1, game_id="g", body="x"))
    pieces.service.generate_illustration(piece.id, IllustrationGenerateRequest(prompt_excerpt="p"))
    pieces.service.delete_for_profile(1)
    assert pieces.service.list_for(1, None) == ()
    assert pieces.repository.illustrations(piece.id) == ()
