"""What the armory feature needs from outside, and the commands it offers. Assembly
supplies the profile lookup (the profiles feature); tests supply fakes."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.armory.armory_schemas_pure import (
    ArmoryEntry,
    ArmoryLooks,
    ArmoryLooksState,
    ArmoryRoundCreate,
    ArmoryState,
    ArtCreate,
    ArtPicture,
    ArtPiece,
    ArtResult,
)

Clock = Callable[[], datetime]
ProfileExists = Callable[[int], bool]
IdFactory = Callable[[], str]


class ArmoryRepository(Protocol):
    """The append-only ledger. Not a cache: each call reads or writes storage."""

    def entries_for(self, profile_id: int) -> tuple[ArmoryEntry, ...]:
        """In the order they were added."""
        ...

    def append(self, entries: Sequence[ArmoryEntry]) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class ArtStudioRepository(ArmoryRepository, Protocol):
    """The ledger plus the profile's art gallery."""

    def list_art(self, profile_id: int) -> tuple[ArtPiece, ...]:
        """Newest first."""
        ...

    def add_art(self, piece: ArtPiece) -> None: ...


class LooksRepository(ArtStudioRepository, Protocol):
    """The ledger and gallery (to check what's owned), plus the profile's saved looks."""

    def looks_for(self, profile_id: int) -> ArmoryLooks | None:
        """None until the profile first saves its looks."""
        ...

    def save_looks(self, profile_id: int, looks: ArmoryLooks) -> None: ...


class ArtMaker(Protocol):
    """The AI image service. None when none is configured, or the call failed."""

    def __call__(self, picture: ArtPicture, prompt: str) -> ArtPicture | None: ...


class ArtStore(Protocol):
    """Where finished pictures are kept; `save` returns the URL they're served at."""

    def save(self, picture: ArtPicture) -> str: ...


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class UnknownItemError(LookupError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"the armory has no item {item_id!r}")


class AlreadyOwnedError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"{item_id!r} is already owned")


class MissingPrerequisiteError(ValueError):
    def __init__(self, item_id: str, requires: str) -> None:
        super().__init__(f"{item_id!r} needs {requires!r} first")


class NotEnoughPointsError(ValueError):
    def __init__(self, item_id: str, price: int, balance: int) -> None:
        super().__init__(f"{item_id!r} costs {price} points; the balance is {balance}")


class NotSoldHereError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"{item_id!r} is bought in the art studio, by making art")


class LookLockedError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"that look needs {item_id!r} first")


class UnknownArtError(LookupError):
    def __init__(self, art_id: str) -> None:
        super().__init__(f"there's no art piece {art_id!r} in this gallery")


class InvalidArtError(ValueError):
    pass


class ArtUnavailableError(RuntimeError):
    def __init__(self) -> None:
        super().__init__("the art studio can't make art right now; no points were spent")


@dataclass(frozen=True)
class ArtStudioService:
    gallery: Callable[[int], tuple[ArtPiece, ...]]
    create_art: Callable[[int, ArtCreate], ArtResult]


@dataclass(frozen=True)
class ArmoryService:
    state: Callable[[int], ArmoryState]
    record_round: Callable[[int, ArmoryRoundCreate], ArmoryState]
    purchase: Callable[[int, str], ArmoryState]


@dataclass(frozen=True)
class LooksService:
    state: Callable[[int], ArmoryLooksState]
    save: Callable[[int, ArmoryLooks], ArmoryLooksState]
