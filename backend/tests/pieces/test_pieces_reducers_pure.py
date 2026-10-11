from app.pieces.pieces_reducers_pure import created_piece, illustration_prompt, revised_piece, word_count
from app.pieces.pieces_schemas_pure import PieceCreate, PieceUpdate
from tests.pieces.pieces_fakes import START


def test_word_count_is_server_computed() -> None:
    assert (word_count(""), word_count("  one  two\nthree ")) == (0, 3)
    piece = created_piece(PieceCreate(profile_id=1, game_id="g", body="a b c"), piece_id="p", now=START)
    assert (piece.id, piece.word_count, piece.revised_at) == ("p", 3, None)


def test_revising_only_changes_what_was_sent_and_stamps_revised_at() -> None:
    piece = created_piece(PieceCreate(profile_id=1, game_id="g", title="T", body="a b"), piece_id="p", now=START)
    retitled = revised_piece(piece, PieceUpdate(title="New"), now=START)
    assert (retitled.title, retitled.body, retitled.word_count, retitled.revised_at) == ("New", "a b", 2, START)
    rewritten = revised_piece(piece, PieceUpdate(body="one two three"), now=START)
    assert (rewritten.title, rewritten.word_count) == ("T", 3)


def test_illustration_prompt_leans_toward_the_art_style() -> None:
    assert illustration_prompt("a fox", "chalk") == (
        "A chalk-drawing illustration on a dark background for a kid's storybook. "
        "No text or lettering anywhere in the image. Scene: a fox"
    )
    assert "warm, painterly children's storybook illustration" in illustration_prompt("a fox", None)
    assert "warm, painterly" in illustration_prompt("a fox", "unknown")
