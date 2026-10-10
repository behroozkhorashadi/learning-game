from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.todo.todo_repository_effect import SqlTodoRepository, make_sql_todo_repository
from app.todo.todo_schemas_pure import TodoId
from tests.todo.todo_fakes import START, record


@pytest.fixture
def repository(tmp_path: Path) -> SqlTodoRepository:
    built = make_sql_todo_repository(engine=create_engine(f"sqlite:///{tmp_path / 'todos.db'}"))
    built.create_schema()
    return built


def test_saved_records_round_trip_with_their_utc_timestamp(repository: SqlTodoRepository) -> None:
    saved = record("a", "read", position=0, done=True)
    repository.save(saved)
    loaded = repository.get(TodoId("a"))
    assert loaded == saved
    assert loaded is not None
    assert loaded.created_at == START


def test_save_overwrites_an_existing_id(repository: SqlTodoRepository) -> None:
    repository.save(record("a", "v1", position=0))
    repository.save(record("a", "v2", position=0))
    assert [r.title for r in repository.list_all()] == ["v2"]


def test_replace_all_drops_records_not_in_the_new_list(repository: SqlTodoRepository) -> None:
    repository.save(record("old", "old", position=0))
    repository.replace_all([record("new", "new", position=0)])
    assert [r.id for r in repository.list_all()] == ["new"]
    repository.replace_all([])
    assert repository.list_all() == ()


def test_missing_id_is_none(repository: SqlTodoRepository) -> None:
    assert repository.get(TodoId("missing")) is None
