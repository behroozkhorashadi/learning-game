"""Pathfinder orchestration: checks the profile through an injected lookup, applies the
pure rules, and reads/writes through the repository."""

from collections.abc import Sequence

from app.pathfinder.pathfinder_ports_pure import (
    Clock,
    MapExistsError,
    MapNotFoundError,
    PathfinderRepository,
    PathfinderService,
    ProfileExists,
    ProfileNames,
    ProfileNotFoundError,
)
from app.pathfinder.pathfinder_reducers_pure import created_map, new_completions, published_rows, updated_map
from app.pathfinder.pathfinder_schemas_pure import (
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
)


def make_pathfinder_service(
    *,
    repository: PathfinderRepository,
    profile_exists: ProfileExists,
    profile_names: ProfileNames,
    clock: Clock,
) -> PathfinderService:
    def require_profile(profile_id: int) -> None:
        if not profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def owned_map(profile_id: int, map_id: str) -> PathfinderCustomMap:
        custom_map = repository.get_map(map_id)
        if custom_map is None or custom_map.profile_id != profile_id:
            raise MapNotFoundError(profile_id, map_id)
        return custom_map

    def completions(profile_id: int) -> tuple[str, ...]:
        require_profile(profile_id)
        return repository.completed_level_ids(profile_id)

    def add_completions(profile_id: int, level_ids: Sequence[str]) -> tuple[str, ...]:
        require_profile(profile_id)
        fresh = new_completions(repository.completed_level_ids(profile_id), level_ids)
        repository.add_completions(profile_id, fresh, clock())
        return repository.completed_level_ids(profile_id)

    def list_maps(profile_id: int) -> tuple[PathfinderCustomMap, ...]:
        require_profile(profile_id)
        return repository.list_maps(profile_id)

    def create_map(profile_id: int, draft: PathfinderCustomMapCreate) -> PathfinderCustomMap:
        require_profile(profile_id)
        custom_map = created_map(profile_id, draft, now=clock())
        if repository.get_map(draft.id) is not None:
            raise MapExistsError(draft.id)
        return repository.save_map(custom_map)

    def update_map(profile_id: int, map_id: str, change: PathfinderCustomMapUpdate) -> PathfinderCustomMap:
        return repository.save_map(updated_map(owned_map(profile_id, map_id), change))

    def delete_map(profile_id: int, map_id: str) -> None:
        repository.delete_map(owned_map(profile_id, map_id).id)

    def published_maps() -> tuple[PublishedPathfinderMap, ...]:
        maps = repository.published_maps()
        return published_rows(maps, profile_names(sorted({m.profile_id for m in maps})))

    return PathfinderService(
        completions=completions,
        add_completions=add_completions,
        list_maps=list_maps,
        create_map=create_map,
        update_map=update_map,
        delete_map=delete_map,
        published_maps=published_maps,
    )
