from app.replays.replays_reducers_pure import beyond_kept
from app.replays.replays_schemas_pure import KEEP_PER_PROFILE, ReplaySummary
from tests.replays.replays_fakes import START


def summary(replay_id: str) -> ReplaySummary:
    return ReplaySummary(
        id=replay_id, profile_id=1, created_at=START, outcome="left", duration_ms=1, flags=0, size_bytes=1
    )


def test_keeps_the_newest_few() -> None:
    newest_first = [summary(f"r{i}") for i in range(KEEP_PER_PROFILE + 2)]
    assert beyond_kept(newest_first) == ("r3", "r4")
    assert beyond_kept(newest_first[:KEEP_PER_PROFILE]) == ()
