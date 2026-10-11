"""Fakes for the replays feature: a ticking clock, sequential ids, profiles 1 and 2."""

from datetime import UTC, datetime, timedelta

from app.replays.replays_schemas_pure import ReplayCreate

START = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)


class TickingClock:
    """Each reading is one second after the last, so "newest first" is well defined."""

    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(seconds=1)
        return reading


class SequentialIds:
    def __init__(self) -> None:
        self.count = 0

    def __call__(self) -> str:
        self.count += 1
        return f"r{self.count}"


def profile_exists(profile_id: int) -> bool:
    return profile_id in (1, 2)


def recording(n: int = 1) -> ReplayCreate:
    return ReplayCreate.model_validate(
        {
            "outcome": "survived",
            "duration_ms": 60000,
            "flags": n,
            "recording": {
                "header": {"version": 1},
                "snapshots": [{"t": 0, "zombies": []}],
                "marks": [{"type": "flag", "n": n}],
            },
        }
    )
