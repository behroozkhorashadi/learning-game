from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, insert

from app.armory.armory_repository_effect import SqlArmoryRepository, make_sql_armory_repository
from app.armory.armory_schemas_pure import ArtPiece
from tests.armory.armory_fakes import NOW, earned


@pytest.fixture
def repository(tmp_path: Path) -> SqlArmoryRepository:
    repo = make_sql_armory_repository(engine=create_engine(f"sqlite:///{tmp_path / 'armory.db'}"))
    repo.create_schema()
    return repo


def test_entries_round_trip_in_order_per_profile(repository: SqlArmoryRepository) -> None:
    repository.append([earned(10), earned(20, profile_id=2)])
    repository.append([earned(30)])
    repository.append([])
    assert repository.entries_for(1) == (earned(10), earned(30))
    assert repository.entries_for(2) == (earned(20, profile_id=2),)


def test_delete_for_profile_leaves_others(repository: SqlArmoryRepository) -> None:
    repository.append([earned(10), earned(20, profile_id=2)])
    repository.delete_for_profile(1)
    assert repository.entries_for(1) == ()
    assert len(repository.entries_for(2)) == 1


def test_a_bad_row_fails_at_the_boundary(repository: SqlArmoryRepository) -> None:
    row = {"profile_id": 1, "kind": "stolen", "item_id": None, "points": 1, "quantity": 0, "created_at": "x"}
    with repository.engine.begin() as connection:
        connection.execute(insert(repository.table).values(**row))
    with pytest.raises(ValueError, match="kind"):
        repository.entries_for(1)


def test_art_round_trips_newest_first_and_goes_with_the_profile(repository: SqlArmoryRepository) -> None:
    older = ArtPiece(
        id="a1", profile_id=1, image_url="/static/armory-art/a1.jpg", style="comic_hero", idea="", created_at=NOW
    )
    newer = older.model_copy(update={"id": "a2", "created_at": NOW + timedelta(minutes=1)})
    theirs = older.model_copy(update={"id": "b1", "profile_id": 2})
    for piece in (older, newer, theirs):
        repository.add_art(piece)
    assert repository.list_art(1) == (newer, older)
    repository.delete_for_profile(1)
    assert repository.list_art(1) == ()
    assert repository.list_art(2) == (theirs,)
