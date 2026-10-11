from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.replays.replays_repository_effect import SqlReplayRepository, make_sql_replay_repository
from app.replays.replays_schemas_pure import ReplaySummary
from tests.replays.replays_fakes import START, recording


@pytest.fixture
def repository(tmp_path: Path) -> SqlReplayRepository:
    repo = make_sql_replay_repository(engine=create_engine(f"sqlite:///{tmp_path / 'replays.db'}"))
    repo.create_schema()
    return repo


def summary(replay_id: str, profile_id: int = 1, seconds: int = 0) -> ReplaySummary:
    created = START.replace(second=seconds)
    return ReplaySummary(
        id=replay_id,
        profile_id=profile_id,
        created_at=created,
        outcome="survived",
        duration_ms=60000,
        flags=1,
        size_bytes=10,
    )


def test_round_trips_a_recording(repository: SqlReplayRepository) -> None:
    repository.add(summary("r1"), recording(2))
    found = repository.get("r1")
    assert found is not None
    assert found.summary == summary("r1")
    assert found.recording == recording(2).recording
    assert repository.get("nope") is None


def test_lists_newest_first_and_deletes(repository: SqlReplayRepository) -> None:
    repository.add(summary("old", seconds=1), recording())
    repository.add(summary("new", seconds=2), recording())
    repository.add(summary("theirs", profile_id=2), recording())
    assert [s.id for s in repository.summaries_for(1)] == ["new", "old"]
    repository.delete(["old"])
    repository.delete([])
    assert [s.id for s in repository.summaries_for(1)] == ["new"]
    repository.delete_for_profile(1)
    assert repository.summaries_for(1) == ()
    assert [s.id for s in repository.summaries_for(2)] == ["theirs"]
