"""Zombie Horde reuses Fact Fluency's facts and tiers under its own game id."""

from app.play.games.arithmetic_reducers_pure import apply_operator
from app.play.games.zombie_horde_reducers_pure import ZombieHordeGame
from tests.play.play_fakes import SeededRng, int_at, list_at, str_at


def test_items_are_tagged_with_the_horde_game_id() -> None:
    item = ZombieHordeGame().generate_item(level=3, rng=SeededRng(7))
    assert item.game_id == "zombie_horde"
    assert item.item_id.startswith("zombie_horde-L3-")


def test_items_are_true_facts_with_four_options_including_the_answer() -> None:
    for level in range(1, ZombieHordeGame().metadata.max_level + 1):
        payload = ZombieHordeGame().generate_item(level=level, rng=SeededRng(level)).payload
        answer = int_at(payload, "answer")
        assert apply_operator(str_at(payload, "operator"), int_at(payload, "left"), int_at(payload, "right")) == answer
        options = list_at(payload, "options")
        assert len(options) == 4
        assert answer in options


def test_supports_practice_config_like_fact_fluency() -> None:
    assert ZombieHordeGame().supports_practice_config()
