"""Fakes for the armory feature's injected capabilities: an in-memory ledger, a fixed
clock, and a profile lookup where profiles 1 and 2 exist."""

from collections.abc import Sequence
from datetime import UTC, datetime

from app.armory.armory_schemas_pure import ArmoryEntry, ArmoryLooks, ArtPicture, ArtPiece

NOW = datetime(2026, 10, 11, 9, 0, tzinfo=UTC)


class InMemoryArmoryRepository:
    def __init__(self) -> None:
        self.entries: list[ArmoryEntry] = []

    def entries_for(self, profile_id: int) -> tuple[ArmoryEntry, ...]:
        return tuple(e for e in self.entries if e.profile_id == profile_id)

    def append(self, entries: Sequence[ArmoryEntry]) -> None:
        self.entries.extend(entries)

    def delete_for_profile(self, profile_id: int) -> None:
        self.entries = [e for e in self.entries if e.profile_id != profile_id]


def clock() -> datetime:
    return NOW


def profile_exists(profile_id: int) -> bool:
    return profile_id in (1, 2)


def earned(points: int, profile_id: int = 1) -> ArmoryEntry:
    return ArmoryEntry(profile_id=profile_id, kind="earned", item_id=None, points=points, quantity=0, created_at=NOW)


SELFIE = "data:image/png;base64,iVBORw0KGgo="


class FakeArtMaker:
    """Returns a fixed picture, or None when `available` is off; records the prompts it got."""

    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.prompts: list[str] = []

    def __call__(self, picture: ArtPicture, prompt: str) -> ArtPicture | None:
        self.prompts.append(prompt)
        return ArtPicture(content=b"art:" + picture.content, content_type="image/jpeg") if self.available else None


class InMemoryArtStudioRepository(InMemoryArmoryRepository):
    def __init__(self) -> None:
        super().__init__()
        self.art: list[ArtPiece] = []

    def list_art(self, profile_id: int) -> tuple[ArtPiece, ...]:
        return tuple(reversed([piece for piece in self.art if piece.profile_id == profile_id]))

    def add_art(self, piece: ArtPiece) -> None:
        self.art.append(piece)


class InMemoryLooksRepository(InMemoryArtStudioRepository):
    def __init__(self) -> None:
        super().__init__()
        self.looks: dict[int, ArmoryLooks] = {}

    def looks_for(self, profile_id: int) -> ArmoryLooks | None:
        return self.looks.get(profile_id)

    def save_looks(self, profile_id: int, looks: ArmoryLooks) -> None:
        self.looks[profile_id] = looks


def bought(item_id: str, profile_id: int = 1) -> ArmoryEntry:
    """A purchase row, as if `item_id` had been bought (free, so the balance is untouched)."""
    return ArmoryEntry(profile_id=profile_id, kind="purchased", item_id=item_id, points=0, quantity=1, created_at=NOW)


def art_piece(art_id: str, profile_id: int = 1) -> ArtPiece:
    return ArtPiece(
        id=art_id,
        profile_id=profile_id,
        image_url=f"/static/armory-art/{art_id}.jpg",
        style="comic_hero",
        idea="",
        created_at=NOW,
    )


class InMemoryArtStore:
    def __init__(self) -> None:
        self.saved: list[ArtPicture] = []

    def save(self, picture: ArtPicture) -> str:
        self.saved.append(picture)
        return f"/static/armory-art/{len(self.saved)}.jpg"


class SequentialIds:
    def __init__(self) -> None:
        self.count = 0

    def __call__(self) -> str:
        self.count += 1
        return f"art-{self.count}"
