"""Prompt Forge: writing-layer game module — HANDOFF.md §5.

Registers the game so it shows up in `GET /api/games` and the kid-home
`GamePicker`. Prompt Forge's forge ingredients and twist cards are fixed game
content that lives client-side (`PromptForge.tsx`, reusing `ModifierDeck`'s
twist-tier cards) — same reasoning as `ModifierDeck`'s own `CARDS` constant.
It has no adaptive items, so `generate_item` is unreachable in practice.
"""

from random import Random

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item


class PromptForgeGame(GameModule):
    metadata = GameMetadata(
        id="prompt_forge",
        title="Prompt Forge",
        tagline="Forge four ingredients, flip a twist, and write.",
        skill_ids=["creative_writing"],
        min_age=7,
        max_age=12,
        icon="\U0001f525",
        max_level=1,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError("prompt_forge is a writing game; it has no adaptive items")


register(PromptForgeGame())
