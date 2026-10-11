from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.pathfinder.pathfinder_ports_pure import (
    MapExistsError,
    MapNotFoundError,
    PathfinderService,
    ProfileNotFoundError,
)
from app.pathfinder.pathfinder_repository_effect import make_sql_pathfinder_repository
from app.pathfinder.pathfinder_schemas_pure import PathfinderCustomMapUpdate
from app.pathfinder.pathfinder_service_effect import make_pathfinder_service
from tests.pathfinder.pathfinder_fakes import TickingClock, draft, profile_exists, profile_names


@pytest.fixture
def service(tmp_path: Path) -> PathfinderService:
    repository = make_sql_pathfinder_repository(engine=create_engine(f"sqlite:///{tmp_path / 'pathfinder.db'}"))
    repository.create_schema()
    return make_pathfinder_service(
        repository=repository, profile_exists=profile_exists, profile_names=profile_names, clock=TickingClock()
    )


def test_completions_are_recorded_once(service: PathfinderService) -> None:
    assert service.add_completions(1, ["easy-a", "easy-b"]) == ("easy-a", "easy-b")
    assert service.add_completions(1, ["easy-b", "easy-c", "easy-c"]) == ("easy-a", "easy-b", "easy-c")
    assert service.completions(2) == ()


def test_unknown_profile(service: PathfinderService) -> None:
    for call in (lambda: service.completions(9), lambda: service.list_maps(9), lambda: service.create_map(9, draft())):
        with pytest.raises(ProfileNotFoundError):
            call()


def test_duplicate_map_id_conflicts(service: PathfinderService) -> None:
    service.create_map(1, draft("custom-dup"))
    with pytest.raises(MapExistsError, match="map custom-dup already exists"):
        service.create_map(2, draft("custom-dup"))


def test_maps_belong_to_their_profile(service: PathfinderService) -> None:
    service.create_map(1, draft("custom-owned"))
    with pytest.raises(MapNotFoundError, match="no map custom-owned for profile 2"):
        service.update_map(2, "custom-owned", PathfinderCustomMapUpdate(name="Mine now"))
    with pytest.raises(MapNotFoundError):
        service.delete_map(2, "custom-owned")
    service.delete_map(1, "custom-owned")
    assert service.list_maps(1) == ()


def test_published_maps_name_their_author(service: PathfinderService) -> None:
    service.create_map(1, draft("custom-pub"))
    service.create_map(1, draft("custom-private"))
    service.update_map(1, "custom-pub", PathfinderCustomMapUpdate(published=True))
    assert [(row.id, row.author_name) for row in service.published_maps()] == [("custom-pub", "Maker")]
