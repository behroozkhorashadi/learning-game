"""Every game module, by id — PRD §6. The writing games (HANDOFF.md §5) and Pathfinder
are registration-only: their content lives client-side (fixed forge ingredients, base
passages, genre lines, case files, hand-authored maps), so they exist here just to be
discoverable via GET /api/games and have no adaptive server-side items."""

from types import MappingProxyType
from typing import override

from app.play.games.equation_builder_reducers_pure import EquationBuilderGame
from app.play.games.fact_fluency_reducers_pure import FactFluencyGame
from app.play.games.game_module_reducers_pure import GameModule
from app.play.games.syllable_builder_reducers_pure import SyllableBuilderGame
from app.play.play_ports_pure import Rng
from app.play.play_schemas_pure import GameMetadata, Item


class ContentOnlyGame(GameModule):
    """A game whose content ships with the client. `generate_item` refuses clearly
    rather than returning something meaningless."""

    def __init__(self, metadata: GameMetadata, reason: str) -> None:
        self.metadata = metadata
        self._reason = reason

    @override
    def generate_item(self, level: int, rng: Rng, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError(f"{self.metadata.id} {self._reason}")


def _writing_game(game_id: str, title: str, tagline: str, icon: str) -> ContentOnlyGame:
    metadata = GameMetadata(
        id=game_id,
        title=title,
        tagline=tagline,
        skill_ids=["creative_writing"],
        min_age=7,
        max_age=12,
        icon=icon,
        max_level=1,
    )
    return ContentOnlyGame(metadata, "is a writing game; it has no adaptive items")


def game_catalog() -> MappingProxyType[str, GameModule]:
    """Every game, in the order GET /api/games has always listed them."""
    games: tuple[GameModule, ...] = (
        SyllableBuilderGame(),
        EquationBuilderGame(),
        FactFluencyGame(),
        _writing_game("prompt_forge", "Prompt Forge", "Forge four ingredients, flip a twist, and write.", "\U0001f525"),
        _writing_game(
            "style_remix_lab",
            "Style Remix Lab",
            "Rewrite the same scene in wild new styles, then pick a favorite.",
            "\U0001f3ad",
        ),
        _writing_game(
            "tag_team_story",
            "Tag-Team Story",
            "Trade one line at a time and watch the story build itself.",
            "\U0001f4d6",
        ),
        _writing_game(
            "clue_master",
            "Clue Master",
            "Write backwards from the ending and see if the AI can solve it.",
            "\U0001f50d",
        ),
        ContentOnlyGame(
            GameMetadata(
                id="pathfinder_no_way_back",
                title="Pathfinder: No Way Back",
                tagline="Connect every dot with one path. No backtracking allowed.",
                skill_ids=["spatial_reasoning"],
                min_age=6,
                max_age=12,
                icon="\U0001f517",
                max_level=1,
            ),
            "is a puzzle game with hand-authored, client-side levels; it has no adaptive items",
        ),
    )
    return MappingProxyType({game.metadata.id: game for game in games})
