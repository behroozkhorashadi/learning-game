"""Personal badge art as files under an injected directory (`<static>/badge-art/`),
served by the app's /static mount."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.badges.badges_schemas_pure import BadgeArtImage

BADGE_ART_URL_PREFIX = "/static/badge-art/"
EXTENSIONS = (("image/webp", "webp"), ("image/png", "png"), ("image/jpeg", "jpg"))


@dataclass(frozen=True)
class FileBadgeArtStore:
    directory: Path
    new_name: Callable[[], str]

    def save(self, image: BadgeArtImage) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        extension = next((ext for content_type, ext in EXTENSIONS if content_type == image.content_type), "png")
        filename = f"{self.new_name()}.{extension}"
        (self.directory / filename).write_bytes(image.content)
        return f"{BADGE_ART_URL_PREFIX}{filename}"


def make_file_badge_art_store(*, directory: Path, new_name: Callable[[], str]) -> FileBadgeArtStore:
    """`new_name` gives each file a unique stem (assembly passes uuid4 hex)."""
    return FileBadgeArtStore(directory=directory, new_name=new_name)
