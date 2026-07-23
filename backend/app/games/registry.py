"""Maps game_id -> the GameModule instance that serves it — PRD §6.

Modules self-register on import (see the bottom of syllable_builder.py);
app/games/__init__.py imports every module so importing `app.games` is enough
to populate the registry.
"""

from app.games.base import GameModule

_REGISTRY: dict[str, GameModule] = {}


def register(game: GameModule) -> None:
    _REGISTRY[game.metadata.id] = game


def get_game(game_id: str) -> GameModule:
    try:
        return _REGISTRY[game_id]
    except KeyError:
        raise KeyError(f"no game registered with id {game_id!r}") from None


def all_games() -> list[GameModule]:
    return list(_REGISTRY.values())
