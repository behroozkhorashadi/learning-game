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

    def score_attempt(self, item: Item, response: dict[str, Any]) -> GradedResult:
        """Writing-only scoring seam via the model-provider layer (PRD §9.1,
        out of scope here). Objective games score client-side and never call
        this; the default raises so an objective game can't accidentally rely
        on a server-side scoring path it doesn't have."""
        raise NotImplementedError(
            f"{self.metadata.id} is an objective game; scoring happens client-side"
        )
