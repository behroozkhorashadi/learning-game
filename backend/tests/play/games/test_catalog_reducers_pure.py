import pytest

from app.play.games.catalog_reducers_pure import game_catalog
from tests.play.play_fakes import SeededRng


def test_every_game_is_listed_in_the_order_the_picker_has_always_shown() -> None:
    assert list(game_catalog()) == [
        "syllable_builder",
        "equation_builder",
        "fact_fluency",
        "prompt_forge",
        "style_remix_lab",
        "tag_team_story",
        "clue_master",
        "pathfinder_no_way_back",
    ]


def test_ids_match_their_metadata_and_ages_are_ordered() -> None:
    for game_id, game in game_catalog().items():
        assert game.metadata.id == game_id
        assert game.metadata.title
        assert game.metadata.tagline
        assert game.metadata.min_age <= game.metadata.max_age


@pytest.mark.parametrize("game_id", ["prompt_forge", "style_remix_lab", "tag_team_story", "clue_master"])
def test_writing_games_have_no_adaptive_items(game_id: str) -> None:
    with pytest.raises(NotImplementedError, match="is a writing game; it has no adaptive items"):
        game_catalog()[game_id].generate_item(level=1, rng=SeededRng(0))


def test_pathfinder_is_registration_only() -> None:
    game = game_catalog()["pathfinder_no_way_back"]
    assert game.metadata.skill_ids == ["spatial_reasoning"]
    with pytest.raises(NotImplementedError, match="hand-authored, client-side levels"):
        game.generate_item(level=1, rng=SeededRng(0))
