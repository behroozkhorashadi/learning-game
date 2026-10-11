"""What the badges feature needs from outside, and the commands it offers. Assembly
supplies the history (from play, pieces, and the event log), the profile check, and
game titles; tests supply fakes."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.badges.badges_schemas_pure import Activity, Badge, BadgeAward, BadgeStatus, ProfileStats, SeedBadge

Clock = Callable[[], datetime]


class BadgeRepository(Protocol):
    def badges(self) -> tuple[Badge, ...]:
        """In id order (seed order)."""
        ...

    def add_missing(self, seeds: Sequence[SeedBadge]) -> None:
        """Seeds any badge whose key isn't stored yet."""
        ...

    def awards(self, profile_id: int) -> Mapping[int, BadgeAward]:
        """By badge id."""
        ...

    def award(self, profile_id: int, badge_id: int, session_id: str | None, awarded_at: datetime) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class BadgeEvents(Protocol):
    def append(
        self,
        *,
        profile_id: int,
        game_id: str,
        event_type: str,
        payload: Mapping[str, object],
        variant_id: str | None,
        session_id: str | None,
    ) -> str: ...


@dataclass(frozen=True)
class BadgeNeighbors:
    activity: Callable[[int], Activity]
    profile_exists: Callable[[int], bool]
    game_title: Callable[[str], str | None]


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


@dataclass(frozen=True)
class BadgesService:
    seed: Callable[[], None]
    # Awards every badge whose criteria are now met: (profile_id, session_id). Returns
    # the keys newly awarded. Idempotent, so safe after every attempt and piece.
    evaluate: Callable[[int, str | None], tuple[str, ...]]
    badges_for: Callable[[int], tuple[BadgeStatus, ...]]
    stats_for: Callable[[int], ProfileStats]
    delete_for_profile: Callable[[int], None]
