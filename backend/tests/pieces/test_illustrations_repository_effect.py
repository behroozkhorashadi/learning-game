from pathlib import Path

from app.pieces.illustrations_repository_effect import make_file_illustration_store
from app.pieces.pieces_schemas_pure import GeneratedImage


def test_saves_one_folder_per_piece_with_the_right_extension(tmp_path: Path) -> None:
    store = make_file_illustration_store(directory=tmp_path, new_name=lambda: "x")
    assert store.save("p1", GeneratedImage(content=b"png")) == "/static/illustrations/p1/x.png"
    assert (
        store.save("p2", GeneratedImage(content=b"jpg", content_type="image/jpeg")) == "/static/illustrations/p2/x.jpg"
    )
    assert (tmp_path / "p1" / "x.png").read_bytes() == b"png"
