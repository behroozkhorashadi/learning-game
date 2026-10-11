from pathlib import Path

from app.profiles.profile_photos_repository_effect import make_file_photo_store
from app.profiles.profiles_schemas_pure import AvatarImage
from tests.profiles.profiles_fakes import files


def test_saves_under_a_fresh_name_and_deletes_only_its_own_files(tmp_path: Path) -> None:
    store = make_file_photo_store(directory=tmp_path / "avatars", new_name=lambda: "abc")
    url = store.save(AvatarImage(content=b"jpeg", content_type="image/jpeg"))
    assert url == "/static/profile-avatars/abc.jpg"
    assert (tmp_path / "avatars" / "abc.jpg").read_bytes() == b"jpeg"

    (tmp_path / "keep.txt").write_text("x")
    for outside in ("fox", "/static/illustrations/x.png", "/static/profile-avatars/../keep.txt"):
        store.delete(outside)
    assert (tmp_path / "keep.txt").exists()

    store.delete(url)
    store.delete(url)  # already gone: no error
    assert files(tmp_path / "avatars") == []
