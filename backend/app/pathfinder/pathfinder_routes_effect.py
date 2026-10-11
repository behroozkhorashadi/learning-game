"""HTTP surface for Pathfinder saved state: completions, custom maps, published maps.
Thin: parse, call the injected service, map domain errors to status codes. No auth,
same as practice-config."""

from fastapi import APIRouter, HTTPException, status

from app.pathfinder.pathfinder_ports_pure import (
    InvalidMapError,
    MapExistsError,
    MapNotFoundError,
    PathfinderService,
    ProfileNotFoundError,
)
from app.pathfinder.pathfinder_schemas_pure import (
    PathfinderCompletionsCreate,
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
)

COMPLETIONS = "/api/profiles/{profile_id}/pathfinder/completions"
MAPS = "/api/profiles/{profile_id}/pathfinder/maps"
MAP = "/api/profiles/{profile_id}/pathfinder/maps/{map_id}"


def bind_pathfinder_routes(*, service: PathfinderService) -> APIRouter:
    router = APIRouter()

    @router.get(COMPLETIONS, response_model=list[str])
    def get_pathfinder_completions(profile_id: int) -> list[str]:
        """Ids of every curated Pathfinder level this kid has finished — the
        level map derives locked/unlocked/completed from these."""
        try:
            return list(service.completions(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post(COMPLETIONS, response_model=list[str])
    def add_pathfinder_completions(profile_id: int, payload: PathfinderCompletionsCreate) -> list[str]:
        """Records finished levels. Idempotent: already-recorded ids are skipped,
        so a replayed level keeps its original completion time. Returns the full
        updated list so the client doesn't need a second round trip."""
        try:
            return list(service.add_completions(profile_id, payload.level_ids))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.get(MAPS, response_model=list[PathfinderCustomMap])
    def list_pathfinder_maps(profile_id: int) -> list[PathfinderCustomMap]:
        """Backs My Maps — most recently created first."""
        try:
            return list(service.list_maps(profile_id))
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    @router.post(MAPS, response_model=PathfinderCustomMap, status_code=status.HTTP_201_CREATED)
    def create_pathfinder_map(profile_id: int, payload: PathfinderCustomMapCreate) -> PathfinderCustomMap:
        try:
            return service.create_map(profile_id, payload)
        except ProfileNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except InvalidMapError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
        except MapExistsError as error:
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error

    @router.patch(MAP, response_model=PathfinderCustomMap)
    def update_pathfinder_map(profile_id: int, map_id: str, payload: PathfinderCustomMapUpdate) -> PathfinderCustomMap:
        """Rename and/or publish/unpublish. `id` and `created_at` never change."""
        try:
            return service.update_map(profile_id, map_id, payload)
        except MapNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error
        except InvalidMapError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

    @router.get("/api/pathfinder/published-maps", response_model=list[PublishedPathfinderMap])
    def list_published_pathfinder_maps() -> list[PublishedPathfinderMap]:
        """Every profile's published maps, newest first. Unpublishing a map just
        drops it from this list."""
        return list(service.published_maps())

    @router.delete(MAP, status_code=status.HTTP_204_NO_CONTENT)
    def delete_pathfinder_map(profile_id: int, map_id: str) -> None:
        try:
            service.delete_map(profile_id, map_id)
        except MapNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(error)) from error

    return router
