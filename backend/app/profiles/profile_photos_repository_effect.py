"""Profile picture files under an injected directory (`<static>/profile-avatars/`),
served by the app's /static mount. Rows saying which profile owns which file live in
profiles_repository_effect.py."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.profiles.profiles_reducers_pure import PHOTO_URL_PREFIX
from app.profiles.profiles_schemas_pure import AvatarImage


@dataclass(frozen=True)
class FilePhotoStore:
    directory: Path
    new_name: Callable[[], str]

    def save(self, image: AvatarImage) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        extension = "png" if image.content_type == "image/png" else "jpg"
        filename = f"{self.new_name()}.{extension}"
        (self.directory / filename).write_bytes(image.content)
        return f"{PHOTO_URL_PREFIX}{filename}"

    def delete(self, url: str) -> None:
        if not url.startswith(PHOTO_URL_PREFIX):
            return
        filename = url.removeprefix(PHOTO_URL_PREFIX)
        if filename and "/" not in filename and "\\" not in filename:
            (self.directory / filename).unlink(missing_ok=True)


def make_file_photo_store(*, directory: Path, new_name: Callable[[], str]) -> FilePhotoStore:
    """`new_name` gives each file a unique stem (assembly passes uuid4 hex)."""
    return FilePhotoStore(directory=directory, new_name=new_name)
