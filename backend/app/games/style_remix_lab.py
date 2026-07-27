"""Style Remix Lab: writing-layer game module — HANDOFF.md §5.

Registers the game so it shows up in `GET /api/games` and the kid-home
`GamePicker`. The base passage and style cards are fixed game content that
lives client-side (`StyleRemixLab.tsx`) — same reasoning as `PromptForge`'s
forge ingredients. It has no adaptive items, so `generate_item` is
unreachable in practice.
"""

from random import Random

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item


class StyleRemixLabGame(GameModule):
    metadata = GameMetadata(
        id="style_remix_lab",
        title="Style Remix Lab",
        tagline="Rewrite the same scene in wild new styles, then pick a favorite.",
        skill_ids=["creative_writing"],
        min_age=7,
        max_age=12,
        icon="\U0001f3ad",
        max_level=1,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError("style_remix_lab is a writing game; it has no adaptive items")


register(StyleRemixLabGame())
