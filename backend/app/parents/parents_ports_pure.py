"""What the parents feature needs from outside, the commands it offers, and its domain
errors. Assembly supplies the kids (profiles), their history (play, events, badges,
pathfinder), and the game catalog; tests supply fakes."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.parents.parents_schemas_pure import (
    GameInfo,
    Kid,
    KidHistory,
    KidReport,
    KidSummary,
    NewParent,
    ParentCreate,
    ParentRead,
    ParentRecord,
)

Clock = Callable[[], datetime]
# A stored (naive UTC) moment on the family's local clock.
LocalTime = Callable[[datetime], datetime]
IsAdminPassword = Callable[[str | None], bool]


class ParentRepository(Protocol):
    def list_all(self) -> tuple[ParentRecord, ...]: ...

    def get(self, parent_id: int) -> ParentRecord | None: ...

    def insert(self, parent: NewParent) -> ParentRecord: ...

    def delete(self, parent_id: int) -> None:
        """The parent and its password."""
        ...

    def password_hash(self, parent_id: int) -> str | None: ...

    def set_password_hash(self, parent_id: int, password_hash: str) -> None: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def matches(self, password: str, stored: str) -> bool: ...


@dataclass(frozen=True)
class ParentNeighbors:
    kids_of: Callable[[int], tuple[Kid, ...]]
    history: Callable[[int], KidHistory]
    # Unlinks every kid from a parent that's being deleted.
    unlink_kids: Callable[[int], None]
    games: Mapping[str, GameInfo]
    is_admin_password: IsAdminPassword


class ParentNotFoundError(LookupError):
    def __init__(self, parent_id: int) -> None:
        super().__init__(f"no parent with id {parent_id}")


class KidNotLinkedError(LookupError):
    def __init__(self, parent_id: int, profile_id: int) -> None:
        super().__init__(f"profile {profile_id} isn't linked to parent {parent_id}")


class InvalidParentError(ValueError):
    """Bad input (a 422), with the message the API returns."""


class WrongParentPasswordError(PermissionError):
    def __init__(self) -> None:
        super().__init__("wrong password for this parent")


class NotAdminError(PermissionError):
    def __init__(self) -> None:
        super().__init__("invalid admin password")


@dataclass(frozen=True)
class ParentsService:
    list_parents: Callable[[], tuple[ParentRead, ...]]
    create_parent: Callable[[ParentCreate], ParentRead]
    # (parent_id, password): raises unless it unlocks the parent.
    unlock: Callable[[int, str], None]
    # (parent_id, admin password header)
    delete_parent: Callable[[int, str | None], None]
    # (parent_id, parent password header)
    kids: Callable[[int, str | None], tuple[KidSummary, ...]]
    # (parent_id, profile_id, parent password header, days)
    report: Callable[[int, int, str | None, int], KidReport]
    # For the profiles feature (through assembly): whether a kid can link to this id.
    exists: Callable[[int], bool]
