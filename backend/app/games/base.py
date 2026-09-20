"""Server-side half of the game-module contract — PRD §6.

The client render+play loop (React) is not implemented here — that's where a
client-side renderer attaches: it receives the `Item` this module produces and
posts back an `AttemptCreate` whose telemetry core the contract requires.
"""

from abc import ABC, abstractmethod
from random import Random
from typing import Any, Optional

from pydantic import BaseModel

from app.models.game import GameMetadata
from app.models.item import Item


class GradedResult(BaseModel):
    """Return shape for score_attempt — writing-only, unimplemented in this task."""

    rubric_scores: dict[str, float]
    feedback: str


class GameModule(ABC):
    """Every game implements this so it plugs into the engine and event log
    without special-casing — PRD §6."""

    metadata: GameMetadata

    @abstractmethod
    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        """Server-side. Deterministic given the same rng seed — PRD §6, §11.

        `exclude` holds `repeat_key()` values already shown this session; a
        game should avoid reselecting them when it has enough pool left to."""
        raise NotImplementedError

    def repeat_key(self, item_payload: dict[str, Any]) -> Optional[str]:
        """Identifies what makes two items "the same" for no-repeat-within-
        session purposes. None (the default) means this game has no such
        concept and no session-level exclusion is applied."""
        return None

    def supports_practice_config(self) -> bool:
        """Whether this game accepts a parent-set `PracticeConfig` (which
        operations are in play, which numbers to focus on per operation, and
        an explicit difficulty) instead of always using the server-adaptive
        Level (PRD §5.1's Loop A). False (the default) means main.py never
        looks up or applies a config for this game — most games don't support
        this yet. Kept as a capability check rather than an `if game_id ==`
        special-case in main.py, per this class's own "no special-casing"
        goal above."""
        return False

    def generate_item_from_practice_config(
        self,
        *,
        difficulty: int,
        operations: list[str],
        focus_numbers: dict[str, list[int]],
        rng: Random,
        exclude: frozenset[str] = frozenset(),
    ) -> Item:
        """Only called when `supports_practice_config()` is True. Takes plain
        primitives (not the `PracticeConfig` model itself) so this base class
        doesn't need to depend on that model."""
        raise NotImplementedError(f"{self.metadata.id} does not support a practice config")

    def score_attempt(self, item: Item, response: dict[str, Any]) -> GradedResult:
        """Writing-only scoring seam via the model-provider layer (PRD §9.1,
        out of scope here). Objective games score client-side and never call
        this; the default raises so an objective game can't accidentally rely
        on a server-side scoring path it doesn't have."""
        raise NotImplementedError(
            f"{self.metadata.id} is an objective game; scoring happens client-side"
        )
