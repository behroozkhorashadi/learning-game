from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.replays.replays_ports_pure import (
    ProfileNotFoundError,
    RecordingTooLargeError,
    ReplayNotFoundError,
    ReplaysService,
)
from app.replays.replays_repository_effect import make_sql_replay_repository
from app.replays.replays_schemas_pure import KEEP_PER_PROFILE, MAX_RECORDING_BYTES
from app.replays.replays_service_effect import make_replays_service
from tests.replays.replays_fakes import SequentialIds, TickingClock, profile_exists, recording


@pytest.fixture
def service(tmp_path: Path) -> ReplaysService:
    repository = make_sql_replay_repository(engine=create_engine(f"sqlite:///{tmp_path / 'replays.db'}"))
    repository.create_schema()
    return make_replays_service(
        repository=repository, profile_exists=profile_exists, clock=TickingClock(), new_id=SequentialIds()
    )


def test_keeps_only_the_last_few_rounds_per_profile(service: ReplaysService) -> None:
    for n in range(KEEP_PER_PROFILE + 2):
        service.save(1, recording(n), 100)
    service.save(2, recording(), 100)
    assert [s.id for s in service.summaries(1)] == ["r5", "r4", "r3"]
    assert [s.id for s in service.summaries(2)] == ["r6"]
    assert service.replay("r5").recording == recording(4).recording
    with pytest.raises(ReplayNotFoundError):
        service.replay("r1")


def test_refuses_an_oversized_recording_or_unknown_profile(service: ReplaysService) -> None:
    with pytest.raises(RecordingTooLargeError):
        service.save(1, recording(), MAX_RECORDING_BYTES + 1)
    with pytest.raises(ProfileNotFoundError):
        service.save(9, recording(), 100)
    with pytest.raises(ProfileNotFoundError):
        service.summaries(9)
