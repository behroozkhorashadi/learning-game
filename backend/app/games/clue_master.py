"""Clue Master: writing-layer game module — HANDOFF.md §5.

Registers the game so it shows up in `GET /api/games` and the kid-home
`GamePicker`. The dealt endings, clue keywords, and canned AI guess/confession
all live client-side (`ClueMaster.tsx`) — same reasoning as `TagTeamStory`'s
fixed genre lines and `StyleRemixLab`'s base passage. It has no adaptive
items, so `generate_item` is unreachable in practice.
"""

from random import Random

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item


class ClueMasterGame(GameModule):
    metadata = GameMetadata(
        id="clue_master",
        title="Clue Master",
        tagline="Write backwards from the ending and see if the AI can solve it.",
        skill_ids=["creative_writing"],
        min_age=7,
        max_age=12,
        icon="\U0001f50d",
        max_level=1,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError("clue_master is a writing game; it has no adaptive items")


register(ClueMasterGame())
