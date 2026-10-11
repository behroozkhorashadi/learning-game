"""Generated illustration files under an injected directory (`<static>/illustrations/`),
one folder per piece. Saved to disk rather than keeping the provider's URL, so they
survive independent of that provider's own hosting/expiry rules."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from app.pieces.pieces_schemas_pure import GeneratedImage


@dataclass(frozen=True)
class FileIllustrationStore:
    directory: Path
    new_name: Callable[[], str]

    def save(self, piece_id: str, image: GeneratedImage) -> str:
        extension = "png" if image.content_type == "image/png" else "jpg"
        piece_dir = self.directory / piece_id
        piece_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{self.new_name()}.{extension}"
        (piece_dir / filename).write_bytes(image.content)
        return f"/static/illustrations/{piece_id}/{filename}"


def make_file_illustration_store(*, directory: Path, new_name: Callable[[], str]) -> FileIllustrationStore:
    return FileIllustrationStore(directory=directory, new_name=new_name)
