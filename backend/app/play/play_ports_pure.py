"""What the play feature needs from outside, the commands it offers, and its domain
errors. Assembly supplies the implementations (the profiles, practice, events and
badges features); tests supply fakes."""

from collections.abc import Callable, Mapping, MutableSequence, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, TypeVar

from app.play.play_schemas_pure import (
    Attempt,
    AttemptCreate,
    AttemptRead,
    GameMetadata,
    Item,
    Level,
    PracticeSettings,
    Rating,
    RatingCreate,
    Verification,
    VerificationCreate,
)

T = TypeVar("T")

Clock = Callable[[], datetime]


class Rng(Protocol):
    """The slice of `random.Random` the games and the pacing rule use. Injected (a
    fresh one per request in the app, a seeded one in tests) so every draw is
    reproducible under a fixed seed."""

    def random(self) -> float: ...

    def randint(self, a: int, b: int, /) -> int: ...

    def choice(self, seq: Sequence[T], /) -> T: ...

    def sample(self, population: Sequence[T], k: int, /) -> list[T]: ...

    def shuffle(self, x: MutableSequence[T], /) -> None: ...

    def getrandbits(self, k: int, /) -> int: ...


class PlayRepository(Protocol):
    """Levels, attempts, ratings, and verifications."""

    def get_level(self, profile_id: int, game_id: str) -> Level | None: ...

    def save_level(self, level: Level) -> Level: ...

    def add_attempt(self, attempt: Attempt) -> Attempt: ...

    def get_attempt(self, attempt_id: int) -> Attempt | None: ...

    def recent_attempts_at_level(self, level: Level, limit: int) -> tuple[Attempt, ...]:
        """Attempts at `level.value` made since `level.updated_at`, oldest first: the
        last `limit` of them."""
        ...

    def add_rating(self, rating: Rating) -> Rating: ...

    def add_verification(self, verification: Verification) -> Verification: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class PlayEvents(Protocol):
    """The append-only event log (PRD §5.3), as play uses it. Event types are the log's
    string values (`item_shown`, `attempt`, ...)."""

    def append(
        self,
        *,
        profile_id: int,
        game_id: str,
        event_type: str,
        payload: Mapping[str, object],
        variant_id: str | None,
        session_id: str | None,
    ) -> str:
        """Returns the new event's id."""
        ...

    def payloads(
        self, *, profile_id: int, game_id: str, session_id: str, event_type: str
    ) -> tuple[dict[str, object], ...]:
        """Payloads of one session's events of one type."""
        ...

    def recent_payloads(
        self, *, profile_id: int, game_id: str, event_type: str, limit: int
    ) -> tuple[dict[str, object], ...]:
        """The most recent payloads of one type across sessions, oldest first."""
        ...

    def latest(
        self, *, profile_id: int, game_id: str, event_types: Sequence[str]
    ) -> tuple[str, dict[str, object]] | None:
        """The most recent of these events for the (profile, game): its type and payload."""
        ...


@dataclass(frozen=True)
class PlayNeighbors:
    """What play reads from, and tells, other features."""

    # The profile's birth year, or None if there is no such profile.
    birth_year: Callable[[int], int | None]
    # A parent-set practice config for (profile, game), or None.
    practice_settings: Callable[[int, str], PracticeSettings | None]
    # After an attempt is recorded: (profile_id, session_id). Awards badges.
    after_attempt: Callable[[int, str | None], None]


@dataclass(frozen=True)
class GameRules:
    """What another feature needs to know about a game: whether it takes a parent-set
    practice config, and its level range."""

    supports_practice_config: bool
    max_level: int


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class UnknownGameError(LookupError):
    """str() is the quoted message the API has always returned (it came from a KeyError)."""

    def __init__(self, game_id: str) -> None:
        super().__init__(repr(f"no game registered with id {game_id!r}"))


class AttemptNotFoundError(LookupError):
    def __init__(self, attempt_id: int) -> None:
        super().__init__(f"no attempt with id {attempt_id}")


@dataclass(frozen=True)
class PlayService:
    list_games: Callable[[], tuple[GameMetadata, ...]]
    # Arguments: the profile id, the game id, and the client's session id if any.
    next_item: Callable[[int, str, str | None], Item]
    record_attempt: Callable[[AttemptCreate], AttemptRead]
    record_rating: Callable[[RatingCreate], Rating]
    record_verification: Callable[[VerificationCreate], Verification]
    # For other features (through assembly).
    game_title: Callable[[str], str | None]
    game_rules: Callable[[str], GameRules | None]
    delete_for_profile: Callable[[int], None]
