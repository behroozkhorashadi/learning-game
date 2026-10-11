import pytest
from pydantic import ValidationError

from app.pieces.pieces_schemas_pure import Piece, PieceCreate, TurnAuthor, TurnLineCreate


def test_create_defaults() -> None:
    parsed = PieceCreate.model_validate({"profile_id": 1, "game_id": "g"})
    assert (parsed.body, parsed.constraints, parsed.title, parsed.art_style) == ("", [], None, None)


def test_turn_authors_are_kid_or_ai() -> None:
    assert TurnLineCreate.model_validate({"author": "kid", "text": "t"}).author is TurnAuthor.KID
    with pytest.raises(ValidationError):
        TurnLineCreate.model_validate({"author": "robot", "text": "t"})


def test_stored_piece_needs_its_server_set_id() -> None:
    with pytest.raises(ValueError, match="set by the server"):
        Piece.model_validate({"profile_id": 1, "game_id": "g"})
