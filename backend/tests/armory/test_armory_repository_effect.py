from pathlib import Path

import pytest
from sqlalchemy import create_engine, insert

from app.armory.armory_repository_effect import SqlArmoryRepository, make_sql_armory_repository
from tests.armory.armory_fakes import earned


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
