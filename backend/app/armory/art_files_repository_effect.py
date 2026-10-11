"""Art studio pictures as files under an injected directory (`<static>/armory-art/`),
served by the app's /static mount."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.armory.armory_schemas_pure import ArtPicture

ART_URL_PREFIX = "/static/armory-art/"


@dataclass(frozen=True)
class FileArtStore:
    directory: Path
    new_name: Callable[[], str]

    def save(self, picture: ArtPicture) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        extension = "png" if picture.content_type == "image/png" else "jpg"
        filename = f"{self.new_name()}.{extension}"
        (self.directory / filename).write_bytes(picture.content)
        return f"{ART_URL_PREFIX}{filename}"


def make_file_art_store(*, directory: Path, new_name: Callable[[], str]) -> FileArtStore:
    """`new_name` gives each file a unique stem (assembly passes uuid4 hex)."""
    return FileArtStore(directory=directory, new_name=new_name)
