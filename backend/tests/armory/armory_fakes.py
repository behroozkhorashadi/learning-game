"""Fakes for the armory feature's injected capabilities: an in-memory ledger, a fixed
clock, and a profile lookup where profiles 1 and 2 exist."""

from collections.abc import Sequence
from datetime import UTC, datetime

from app.armory.armory_schemas_pure import ArmoryEntry

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
