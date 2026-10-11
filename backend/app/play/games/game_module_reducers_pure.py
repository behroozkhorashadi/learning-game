"""Server-side half of the game-module contract — PRD §6.

The client render+play loop (React) is not here: it receives the `Item` a module
produces and posts back an `AttemptCreate` whose telemetry core the contract requires.
Every game implements this so it plugs into Loop A and the event log without
special-casing.
"""

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence

from app.play.play_ports_pure import Rng
from app.play.play_schemas_pure import GameMetadata, Item


class GameModule(ABC):
    metadata: GameMetadata

    @abstractmethod
    def generate_item(self, level: int, rng: Rng, exclude: frozenset[str] = frozenset()) -> Item:
        """Deterministic given the same rng seed — PRD §6, §11.

        `exclude` holds `repeat_key()` values already shown this session; a game should
        avoid reselecting them when it has enough pool left to."""

    def repeat_key(self, item_payload: Mapping[str, object]) -> str | None:
        """What makes two items "the same" for no-repeat-within-session purposes. None
        (the default) means this game has no such concept."""
        return None

    def typical_level_for_age(self, age: int) -> int:
        """Highest level whose content is typical for this age (PRD §4's per-age
        personas). Never a ceiling: Loop A can promote any kid to `metadata.max_level`;
        promotions past this level just need longer streaks (`pace_for_age`). Most games
        have no age-gated tiers, so the default is `metadata.max_level`."""
        return self.metadata.max_level

    def starting_level_for_age(self, age: int) -> int:
        """Where a brand-new profile's Level starts for this game, instead of level 1
        for every age (PRD §4). Most games have no age-gated tiers, so level 1."""
        return 1

    def supports_practice_config(self) -> bool:
        """Whether this game accepts a parent-set practice config instead of the
        server-adaptive Level. A capability check, not an `if game_id ==` special case."""
        return False

    def generate_item_from_practice_config(
        self,
        *,
        difficulty: int,
        operations: Sequence[str],
        focus_numbers: Mapping[str, Sequence[int]],
        rng: Rng,
        exclude: frozenset[str] = frozenset(),
    ) -> Item:
        """Only called when `supports_practice_config()` is True."""
        msg = f"{self.metadata.id} does not support a practice config"
        raise NotImplementedError(msg)


def text_value(payload: Mapping[str, object], key: str) -> str | None:
    value = payload.get(key)
    return value if isinstance(value, str) else None


def int_value(payload: Mapping[str, object], key: str) -> int | None:
    value = payload.get(key)
    return value if isinstance(value, int) and not isinstance(value, bool) else None
