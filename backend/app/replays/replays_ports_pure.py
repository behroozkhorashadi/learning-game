"""What the replays feature needs from outside, and the commands it offers."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.replays.replays_schemas_pure import Replay, ReplayCreate, ReplaySummary

Clock = Callable[[], datetime]
IdFactory = Callable[[], str]
ProfileExists = Callable[[int], bool]


class ReplayRepository(Protocol):
    def add(self, summary: ReplaySummary, recording: ReplayCreate) -> None:
        """Stores the recording; `summary.size_bytes` is set by the caller."""
        ...

    def summaries_for(self, profile_id: int) -> tuple[ReplaySummary, ...]:
        """Newest first."""
        ...

    def get(self, replay_id: str) -> Replay | None: ...

    def delete(self, replay_ids: Sequence[str]) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class ReplayNotFoundError(LookupError):
    def __init__(self, replay_id: str) -> None:
        super().__init__(f"no replay {replay_id!r}")


class RecordingTooLargeError(ValueError):
    def __init__(self, size: int) -> None:
        super().__init__(f"the recording is {size} bytes; the limit is far smaller")


@dataclass(frozen=True)
class ReplaysService:
    save: Callable[[int, ReplayCreate, int], ReplaySummary]
    summaries: Callable[[int], tuple[ReplaySummary, ...]]
    replay: Callable[[str], Replay]
