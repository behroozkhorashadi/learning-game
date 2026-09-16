"""Pathfinder is registration-only: metadata must be discoverable via the
registry (so it appears in GET /api/games), and generate_item must clearly
refuse rather than silently returning something meaningless, since the game
has no adaptive server-side items."""

from random import Random

import pytest

from app.games.pathfinder import PathfinderGame
from app.games.registry import get_game

GAME = PathfinderGame()


def test_registers_under_its_own_id():
    assert get_game("pathfinder_no_way_back") is not None


def test_metadata_shape():
    assert GAME.metadata.id == "pathfinder_no_way_back"
    assert GAME.metadata.title
    assert GAME.metadata.tagline
    assert GAME.metadata.min_age <= GAME.metadata.max_age


def test_generate_item_raises_not_implemented():
    with pytest.raises(NotImplementedError):
        GAME.generate_item(level=1, rng=Random(0))
