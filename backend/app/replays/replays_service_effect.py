"""Replays orchestration: keeps a profile's newest recordings and drops the rest."""

from app.replays.replays_ports_pure import (
    Clock,
    IdFactory,
    ProfileExists,
    ProfileNotFoundError,
    RecordingTooLargeError,
    ReplayNotFoundError,
    ReplayRepository,
    ReplaysService,
)
from app.replays.replays_reducers_pure import beyond_kept
from app.replays.replays_schemas_pure import MAX_RECORDING_BYTES, Replay, ReplayCreate, ReplaySummary


def make_replays_service(
    *, repository: ReplayRepository, profile_exists: ProfileExists, clock: Clock, new_id: IdFactory
) -> ReplaysService:
    def require_profile(profile_id: int) -> None:
        if not profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def save(profile_id: int, request: ReplayCreate, size_bytes: int) -> ReplaySummary:
        """`size_bytes` is the request body's size, measured by the route."""
        require_profile(profile_id)
        if size_bytes > MAX_RECORDING_BYTES:
            raise RecordingTooLargeError(size_bytes)
        summary = ReplaySummary(
            id=new_id(),
            profile_id=profile_id,
            created_at=clock(),
            outcome=request.outcome,
            duration_ms=request.duration_ms,
            flags=request.flags,
            size_bytes=size_bytes,
        )
        repository.add(summary, request)
        repository.delete(beyond_kept(repository.summaries_for(profile_id)))
        return summary

    def summaries(profile_id: int) -> tuple[ReplaySummary, ...]:
        require_profile(profile_id)
        return repository.summaries_for(profile_id)

    def replay(replay_id: str) -> Replay:
        found = repository.get(replay_id)
        if found is None:
            raise ReplayNotFoundError(replay_id)
        return found

    return ReplaysService(save=save, summaries=summaries, replay=replay)
