"""Fakes for the pathfinder feature's injected capabilities."""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from types import MappingProxyType

from app.pathfinder.pathfinder_schemas_pure import PathfinderCustomMapCreate

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)
PROFILES = MappingProxyType({1: "Maker", 2: "Other"})
DOTS = ({"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 1})


class TickingClock:
    """Each reading is one second after the last, so "newest first" is well defined."""

    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(seconds=1)
        return reading


def profile_exists(profile_id: int) -> bool:
    return profile_id in PROFILES


def profile_names(profile_ids: Sequence[int]) -> Mapping[int, str]:
    return {profile_id: PROFILES[profile_id] for profile_id in profile_ids if profile_id in PROFILES}


def map_body(map_id: str = "custom-abc", /, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "id": map_id,
        "name": "Kid_map1",
        "difficulty": "easy",
        "rows": 2,
        "columns": 2,
        "dots": [dict(dot) for dot in DOTS],
    }
    body.update(overrides)
    return body


def draft(map_id: str = "custom-abc", /, **overrides: object) -> PathfinderCustomMapCreate:
    return PathfinderCustomMapCreate.model_validate(map_body(map_id, **overrides))
