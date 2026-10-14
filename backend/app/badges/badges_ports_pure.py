"""What the badges feature needs from outside, and the commands it offers. Assembly
supplies the history (from play, pieces, and the event log), the profile check, game
titles, the local calendar, and the art painter; tests supply fakes."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.badges.badges_schemas_pure import (
    Activity,
    AwardDetail,
    Badge,
    BadgeArtImage,
    BadgeAward,
    BadgeStatus,
    ProfileStats,
    SeedBadge,
)

Clock = Callable[[], datetime]
# The local calendar day a moment falls on (stored moments are naive UTC).
LocalDay = Callable[[datetime], date]


class BadgeRepository(Protocol):
    def badges(self) -> tuple[Badge, ...]:
        """In id order (seed order)."""
        ...

    def sync(self, seeds: Sequence[SeedBadge]) -> None:
        """Seeds any badge whose key isn't stored yet, and brings the stored ones'
        name, description, and criteria up to date."""
        ...

    def awards(self, profile_id: int) -> Mapping[int, BadgeAward]:
        """By badge id."""
        ...

    def award(self, profile_id: int, badge_id: int, session_id: str | None, awarded_at: datetime) -> None: ...

    def details(self, profile_id: int) -> Mapping[int, AwardDetail]:
        """By badge id. Awards from before details existed have none."""
        ...

    def save_detail(self, profile_id: int, detail: AwardDetail) -> None: ...

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


class BadgeArtStore(Protocol):
    def save(self, image: BadgeArtImage) -> str:
        """Returns the URL the picture is served at."""
        ...


@dataclass(frozen=True)
class BadgeArt:
    """Painting a profile's own art for a badge. `paint` takes the prompt and returns
    None when it can't (no provider, or the provider failed). `run_later` runs the
    painting off the request that earned the badge."""

    paint: Callable[[str], BadgeArtImage | None]
    store: BadgeArtStore
    run_later: Callable[[Callable[[], None]], None]


@dataclass(frozen=True)
class BadgeNeighbors:
    activity: Callable[[int], Activity]
    profile_exists: Callable[[int], bool]
    game_title: Callable[[str], str | None]
    # The profile's avatar as a word for the art ("fox"), or None (a photo, or none).
    mascot: Callable[[int], str | None]


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class BadgeNotFoundError(LookupError):
    def __init__(self, key: str) -> None:
        super().__init__(f"no badge {key!r}")


class BadgeNotEarnedError(ValueError):
    def __init__(self, key: str) -> None:
        super().__init__(f"badge {key!r} isn't earned yet")


@dataclass(frozen=True)
class BadgesService:
    seed: Callable[[], None]
    # Awards every badge whose criteria are now met: (profile_id, session_id). Returns
    # the keys newly awarded, and starts painting their art. Idempotent, so safe after
    # every attempt and piece.
    evaluate: Callable[[int, str | None], tuple[str, ...]]
    badges_for: Callable[[int], tuple[BadgeStatus, ...]]
    # Earned badges whose celebration the kid hasn't seen, oldest first.
    uncelebrated: Callable[[int], tuple[BadgeStatus, ...]]
    mark_celebrated: Callable[[int, str], None]
    # Paints (or repaints) a profile's art for an earned badge, waiting for it.
    paint: Callable[[int, str], BadgeStatus]
    stats_for: Callable[[int], ProfileStats]
    delete_for_profile: Callable[[int], None]
