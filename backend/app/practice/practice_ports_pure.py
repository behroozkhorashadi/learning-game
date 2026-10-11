"""What the practice feature needs from outside, and the commands it offers.
Assembly supplies the implementations (the profiles and play features); tests supply fakes."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert

Clock = Callable[[], datetime]
ProfileExists = Callable[[int], bool]


@dataclass(frozen=True)
class PracticeGame:
    """What practice needs to know about a game: whether it takes a config, and its
    level range (the bound on `difficulty`)."""

    supports_practice_config: bool
    max_level: int


class PracticeGames(Protocol):
    """Looks up a game by id. None for an unknown game."""

    def __call__(self, game_id: str, /) -> PracticeGame | None: ...


class PracticeConfigRepository(Protocol):
    """Hydrates and saves configs, one per (profile, game)."""

    def get(self, profile_id: int, game_id: str) -> PracticeConfig | None: ...

    def save(self, config: PracticeConfig) -> PracticeConfig:
        """Inserts (id None) or replaces the row; returns it as stored."""
        ...

    def delete(self, profile_id: int, game_id: str) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class PracticeConfigNotFoundError(LookupError):
    def __init__(self) -> None:
        super().__init__("no practice config set for this profile/game")


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class UnknownGameError(LookupError):
    """str() is the quoted message the API has always returned (it came from a KeyError)."""

    def __init__(self, game_id: str) -> None:
        super().__init__(repr(f"no game registered with id {game_id!r}"))


class InvalidPracticeConfigError(ValueError):
    pass


@dataclass(frozen=True)
class PracticeService:
    get_config: Callable[[int, str], PracticeConfig]
    put_config: Callable[[PracticeConfigUpsert], PracticeConfig]
    delete_config: Callable[[int, str], None]
