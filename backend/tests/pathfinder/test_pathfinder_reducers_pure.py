import pytest

from app.pathfinder.pathfinder_ports_pure import InvalidMapError
from app.pathfinder.pathfinder_reducers_pure import created_map, new_completions, published_rows, updated_map
from app.pathfinder.pathfinder_schemas_pure import PathfinderCustomMapUpdate
from tests.pathfinder.pathfinder_fakes import START, draft


def test_new_completions_dedupes_and_skips_finished_levels() -> None:
    assert new_completions(["easy-a"], ["easy-b", "easy-a", "easy-c", "easy-c"]) == ("easy-b", "easy-c")


def test_created_map_trims_the_name_and_starts_unpublished() -> None:
    custom_map = created_map(3, draft(name="  Spiral "), now=START)
    assert (custom_map.profile_id, custom_map.name, custom_map.published) == (3, "Spiral", False)
    assert custom_map.dots[0] == {"row": 0, "col": 0}


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"difficulty": "impossible"}, "difficulty must be one of ('easy', 'medium', 'hard', 'legendary')"),
        ({"name": "   "}, "name must not be empty"),
        ({"dots": []}, "a map needs at least one dot"),
    ],
)
def test_created_map_rejects_bad_input(overrides: dict[str, object], message: str) -> None:
    with pytest.raises(InvalidMapError) as raised:
        created_map(1, draft(**overrides), now=START)
    assert str(raised.value) == message


def test_updated_map_renames_and_publishes_without_touching_identity() -> None:
    original = created_map(1, draft("custom-x"), now=START)
    renamed = updated_map(original, PathfinderCustomMapUpdate(name=" Spiral "))
    published = updated_map(renamed, PathfinderCustomMapUpdate(published=True))
    assert (published.id, published.created_at, published.name, published.published) == (
        "custom-x",
        START,
        "Spiral",
        True,
    )
    with pytest.raises(InvalidMapError):
        updated_map(original, PathfinderCustomMapUpdate(name=" "))


def test_published_rows_carry_the_author_and_skip_orphans() -> None:
    mine = created_map(1, draft("custom-1"), now=START)
    orphan = created_map(9, draft("custom-9"), now=START)
    rows = published_rows([mine, orphan], {1: "Maker"})
    assert [(row.id, row.author_name, row.author_profile_id) for row in rows] == [("custom-1", "Maker", 1)]
    assert rows[0].dots[2].row == 1
