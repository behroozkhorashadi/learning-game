from pathlib import Path

from sqlalchemy import inspect, text

from app.pieces.pieces_reducers_pure import created_piece
from app.pieces.pieces_schemas_pure import PieceCreate, TurnAuthor, TurnLine
from tests.pieces.pieces_fakes import START, piece_harness


def test_keeps_the_existing_tables_and_stores_authors_by_name(tmp_path: Path) -> None:
    repository = piece_harness(tmp_path).repository
    assert sorted(inspect(repository.engine).get_table_names()) == [
        "illustration",
        "piece",
        "remixversion",
        "revisionpass",
        "turnline",
    ]
    piece = repository.save(created_piece(PieceCreate(profile_id=1, game_id="g"), piece_id="p1", now=START))
    turn = repository.add_turn(TurnLine(piece_id=piece.id, author=TurnAuthor.AI, text="hi", created_at=START))
    assert (turn.id, turn.author) == (1, TurnAuthor.AI)
    with repository.engine.connect() as connection:
        assert connection.execute(text("SELECT author FROM turnline")).scalar_one() == "AI"


def test_delete_takes_the_children(tmp_path: Path) -> None:
    repository = piece_harness(tmp_path).repository
    kept = repository.save(created_piece(PieceCreate(profile_id=2, game_id="g"), piece_id="kept", now=START))
    gone = repository.save(created_piece(PieceCreate(profile_id=1, game_id="g"), piece_id="gone", now=START))
    for piece in (kept, gone):
        repository.add_turn(TurnLine(piece_id=piece.id, author=TurnAuthor.KID, text="t", created_at=START))
    repository.delete(gone.id)
    assert repository.get(gone.id) is None
    assert repository.get(kept.id) == kept
    with repository.engine.connect() as connection:
        assert connection.execute(text("SELECT piece_id FROM turnline")).scalars().all() == ["kept"]
