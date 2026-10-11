from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from app.practice.practice_reducers_pure import upserted
from app.practice.practice_repository_effect import SqlPracticeConfigRepository, make_sql_practice_config_repository
from tests.practice.practice_fakes import START, upsert


@pytest.fixture
def repository(tmp_path: Path) -> SqlPracticeConfigRepository:
    repo = make_sql_practice_config_repository(engine=create_engine(f"sqlite:///{tmp_path / 'practice.db'}"))
    repo.create_schema()
    return repo


def test_keeps_the_existing_table_name(repository: SqlPracticeConfigRepository) -> None:
    assert inspect(repository.engine).get_table_names() == ["practiceconfig"]


def test_insert_then_replace_in_place(repository: SqlPracticeConfigRepository) -> None:
    first = repository.save(upserted(None, upsert(operations=["×"], focus_numbers={"×": [7]}), now=START))
    assert first.id is not None
    assert repository.get(1, "fact_fluency") == first

    second = repository.save(upserted(first, upsert(difficulty=8), now=START))
    assert (second.id, second.difficulty) == (first.id, 8)


def test_delete_and_delete_for_profile(repository: SqlPracticeConfigRepository) -> None:
    repository.save(upserted(None, upsert(), now=START))
    repository.save(upserted(None, upsert(game_id="other"), now=START))
    repository.save(upserted(None, upsert(profile_id=2), now=START))

    repository.delete(1, "fact_fluency")
    assert repository.get(1, "fact_fluency") is None
    repository.delete_for_profile(1)
    assert repository.get(1, "other") is None
    assert repository.get(2, "fact_fluency") is not None
