import pytest

from app.play.games.catalog_reducers_pure import game_catalog
from app.play.games.game_module_reducers_pure import int_value, text_value
from tests.play.play_fakes import SeededRng


def test_defaults_for_games_without_age_tiers_or_practice_configs() -> None:
    game = game_catalog()["syllable_builder"]
    assert game.typical_level_for_age(5) == game.metadata.max_level
    assert game.starting_level_for_age(12) == 1
    assert game.supports_practice_config() is False
    assert game_catalog()["prompt_forge"].repeat_key({"anything": 1}) is None
    with pytest.raises(NotImplementedError, match="does not support a practice config"):
        game.generate_item_from_practice_config(difficulty=1, operations=["+"], focus_numbers={}, rng=SeededRng(0))


def test_payload_readers_only_return_the_expected_type() -> None:
    payload: dict[str, object] = {"word": "cat", "n": 3, "flag": True}
    assert (text_value(payload, "word"), text_value(payload, "n"), text_value(payload, "missing")) == (
        "cat",
        None,
        None,
    )
    assert (int_value(payload, "n"), int_value(payload, "flag"), int_value(payload, "word")) == (3, None, None)
