from pathlib import Path

from app.armory.armory_schemas_pure import ArtPicture
from app.armory.art_files_repository_effect import make_file_art_store


def test_saves_each_picture_under_a_new_name_and_returns_its_url(tmp_path: Path) -> None:
    names = iter(["one", "two"])
    store = make_file_art_store(directory=tmp_path / "armory-art", new_name=lambda: next(names))
    assert store.save(ArtPicture(content=b"jpeg", content_type="image/jpeg")) == "/static/armory-art/one.jpg"
    assert store.save(ArtPicture(content=b"png", content_type="image/png")) == "/static/armory-art/two.png"
    assert (tmp_path / "armory-art" / "one.jpg").read_bytes() == b"jpeg"
