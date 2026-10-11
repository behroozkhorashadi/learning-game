"""What the pathfinder feature needs from outside, and the commands it offers.
Assembly supplies the profile lookups (the profiles feature); tests supply fakes."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.pathfinder.pathfinder_schemas_pure import (
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
)

Clock = Callable[[], datetime]
ProfileExists = Callable[[int], bool]
# Names for the given profile ids; ids with no profile are simply absent.
ProfileNames = Callable[[Sequence[int]], Mapping[int, str]]


class PathfinderRepository(Protocol):
    def completed_level_ids(self, profile_id: int) -> tuple[str, ...]:
        """In completion order."""
        ...

    def add_completions(self, profile_id: int, level_ids: Sequence[str], completed_at: datetime) -> None: ...

    def list_maps(self, profile_id: int) -> tuple[PathfinderCustomMap, ...]:
        """Newest first."""
        ...

    def published_maps(self) -> tuple[PathfinderCustomMap, ...]:
        """Every profile's published maps, newest first."""
        ...

    def get_map(self, map_id: str) -> PathfinderCustomMap | None: ...

    def save_map(self, custom_map: PathfinderCustomMap) -> PathfinderCustomMap:
        """Inserts or replaces the map; returns it as stored."""
        ...

    def delete_map(self, map_id: str) -> None: ...

    def delete_for_profile(self, profile_id: int) -> None: ...


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: int) -> None:
        super().__init__(f"no profile with id {profile_id}")


class MapNotFoundError(LookupError):
    def __init__(self, profile_id: int, map_id: str) -> None:
        super().__init__(f"no map {map_id} for profile {profile_id}")


class MapExistsError(ValueError):
    def __init__(self, map_id: str) -> None:
        super().__init__(f"map {map_id} already exists")


class InvalidMapError(ValueError):
    pass


@dataclass(frozen=True)
class PathfinderService:
    completions: Callable[[int], tuple[str, ...]]
    add_completions: Callable[[int, Sequence[str]], tuple[str, ...]]
    list_maps: Callable[[int], tuple[PathfinderCustomMap, ...]]
    create_map: Callable[[int, PathfinderCustomMapCreate], PathfinderCustomMap]
    update_map: Callable[[int, str, PathfinderCustomMapUpdate], PathfinderCustomMap]
    delete_map: Callable[[int, str], None]
    published_maps: Callable[[], tuple[PublishedPathfinderMap, ...]]
