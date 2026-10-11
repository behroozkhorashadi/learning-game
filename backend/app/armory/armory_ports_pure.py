"""What the armory feature needs from outside, and the commands it offers. Assembly
supplies the profile lookup (the profiles feature); tests supply fakes."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.armory.armory_schemas_pure import ArmoryEntry, ArmoryRoundCreate, ArmoryState

Clock = Callable[[], datetime]
ProfileExists = Callable[[int], bool]


class ArmoryRepository(Protocol):
    """The append-only ledger. Not a cache: each call reads or writes storage."""

    def entries_for(self, profile_id: int) -> tuple[ArmoryEntry, ...]:
        """In the order they were added."""
        ...

    def append(self, entries: Sequence[ArmoryEntry]) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


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


@dataclass(frozen=True)
class ArmoryService:
    state: Callable[[int], ArmoryState]
    record_round: Callable[[int, ArmoryRoundCreate], ArmoryState]
    purchase: Callable[[int, str], ArmoryState]
