from pathlib import Path

from app.badges.badge_art_files_repository_effect import make_file_badge_art_store
from app.badges.badges_schemas_pure import BadgeArtImage


def test_saves_each_picture_under_a_new_name_and_returns_its_url(tmp_path: Path) -> None:
    names = iter(["one", "two"])
    store = make_file_badge_art_store(directory=tmp_path / "badge-art", new_name=lambda: next(names))
    assert store.save(BadgeArtImage(content=b"webp", content_type="image/webp")) == "/static/badge-art/one.webp"
    assert store.save(BadgeArtImage(content=b"png", content_type="image/png")) == "/static/badge-art/two.png"
    assert (tmp_path / "badge-art" / "one.webp").read_bytes() == b"webp"
