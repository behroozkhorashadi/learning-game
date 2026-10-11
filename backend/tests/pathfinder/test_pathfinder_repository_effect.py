from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from app.pathfinder.pathfinder_reducers_pure import created_map
from app.pathfinder.pathfinder_repository_effect import SqlPathfinderRepository, make_sql_pathfinder_repository
from tests.pathfinder.pathfinder_fakes import START, TickingClock, draft


@pytest.fixture
def repository(tmp_path: Path) -> SqlPathfinderRepository:
    repo = make_sql_pathfinder_repository(engine=create_engine(f"sqlite:///{tmp_path / 'pathfinder.db'}"))
    repo.create_schema()
    return repo


def test_keeps_the_existing_tables_and_indexes(repository: SqlPathfinderRepository) -> None:
    inspector = inspect(repository.engine)
    assert sorted(inspector.get_table_names()) == ["pathfindercustommap", "pathfinderlevelcompletion"]
    assert [ix["name"] for ix in inspector.get_indexes("pathfindercustommap")] == ["ix_pathfindercustommap_profile_id"]


def test_completions_come_back_in_completion_order(repository: SqlPathfinderRepository) -> None:
    repository.add_completions(1, ["b", "a"], START)
    repository.add_completions(1, [], START)
    repository.add_completions(2, ["z"], START)
    assert repository.completed_level_ids(1) == ("b", "a")


def test_maps_round_trip_newest_first(repository: SqlPathfinderRepository) -> None:
    clock = TickingClock()
    old = repository.save_map(created_map(1, draft("custom-old"), now=clock()))
    new = repository.save_map(created_map(1, draft("custom-new"), now=clock()))
    repository.save_map(created_map(2, draft("custom-theirs"), now=clock()).model_copy(update={"published": True}))

    assert repository.list_maps(1) == (new, old)
    assert repository.get_map("custom-old") == old
    assert [m.id for m in repository.published_maps()] == ["custom-theirs"]


def test_save_replaces_and_deletes_remove(repository: SqlPathfinderRepository) -> None:
    stored = repository.save_map(created_map(1, draft("custom-x"), now=START))
    repository.save_map(stored.model_copy(update={"name": "Renamed"}))
    renamed = repository.get_map("custom-x")
    assert renamed is not None
    assert renamed.name == "Renamed"

    repository.delete_map("custom-x")
    assert repository.get_map("custom-x") is None

    repository.save_map(created_map(1, draft("custom-y"), now=START))
    repository.add_completions(1, ["a"], START)
    repository.delete_for_profile(1)
    assert (repository.list_maps(1), repository.completed_level_ids(1)) == ((), ())
