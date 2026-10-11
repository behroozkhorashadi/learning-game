"""HTTP surface for round recordings: save one (the server keeps a profile's last
few), list a profile's, fetch one whole. Thin: parse, call the service, map errors."""

from fastapi import APIRouter, HTTPException, Request, status

from app.replays.replays_ports_pure import (
    ProfileNotFoundError,
    RecordingTooLargeError,
    ReplayNotFoundError,
    ReplaysService,
)
from app.replays.replays_schemas_pure import Replay, ReplayCreate, ReplaySummary

REPLAYS = "/api/profiles/{profile_id}/horde/replays"


def bind_replays_routes(*, service: ReplaysService) -> APIRouter:
    router = APIRouter(tags=["replays"])

    @router.post(REPLAYS, status_code=status.HTTP_201_CREATED)
    async def save_horde_replay(profile_id: int, payload: ReplayCreate, request: Request) -> ReplaySummary:
        """Keeps a finished (or left) round's recording; older ones past the last few are dropped."""
        size = len(await request.body())
        try:
            return service.save(profile_id, payload, size)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except RecordingTooLargeError as error:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, str(error)) from error

    @router.get(REPLAYS)
    def list_horde_replays(profile_id: int) -> list[ReplaySummary]:
        """The profile's kept recordings, newest first, without their data."""
        try:
            return list(service.summaries(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.get("/api/horde/replays/{replay_id}")
    def get_horde_replay(replay_id: str) -> Replay:
        try:
            return service.replay(replay_id)
        except ReplayNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
