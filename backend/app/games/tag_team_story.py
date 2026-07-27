"""Tag-Team Story: writing-layer game module — HANDOFF.md §5.

Registers the game so it shows up in `GET /api/games` and the kid-home
`GamePicker`. The AI's lines are fixed per-genre content that lives
client-side (`TagTeamStory.tsx`) — same reasoning as `PromptForge`'s forge
ingredients and `StyleRemixLab`'s base passage. It has no adaptive items, so
`generate_item` is unreachable in practice.
"""

from random import Random

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item


class TagTeamStoryGame(GameModule):
    metadata = GameMetadata(
        id="tag_team_story",
        title="Tag-Team Story",
        tagline="Trade one line at a time and watch the story build itself.",
        skill_ids=["creative_writing"],
        min_age=7,
        max_age=12,
        icon="\U0001f4d6",
        max_level=1,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError("tag_team_story is a writing game; it has no adaptive items")


register(TagTeamStoryGame())
