"""Pathfinder: No Way Back — registration-only game module.

A connect-the-dots puzzle: draw one continuous path that visits every dot on
a grid exactly once, moving only left/right/up/down, never revisiting a dot.
There is no adaptive server-generated item — every level is a hand-authored,
solver-validated map that ships with the client (`pathfinderLevels.ts`),
same reasoning as `ClueMaster`'s fixed case files. This module exists only so
the game is discoverable via `GET /api/games` / `GamePicker`.
"""

from random import Random

from app.games.base import GameModule
from app.games.registry import register
from app.models.game import GameMetadata
from app.models.item import Item


class PathfinderGame(GameModule):
    metadata = GameMetadata(
        id="pathfinder_no_way_back",
        title="Pathfinder: No Way Back",
        tagline="Connect every dot with one path. No backtracking allowed.",
        skill_ids=["spatial_reasoning"],
        min_age=6,
        max_age=12,
        icon="\U0001f517",
        max_level=1,
    )

    def generate_item(self, level: int, rng: Random, exclude: frozenset[str] = frozenset()) -> Item:
        raise NotImplementedError(
            "pathfinder_no_way_back is a puzzle game with hand-authored, client-side levels; it has no adaptive items"
        )


register(PathfinderGame())
