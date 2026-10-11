import pytest
from pydantic import ValidationError

from app.pathfinder.pathfinder_schemas_pure import (
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
)
from tests.pathfinder.pathfinder_fakes import START, map_body


def test_create_parses_grid_positions() -> None:
    parsed = PathfinderCustomMapCreate.model_validate(map_body())
    assert parsed.dots[1].col == 1


def test_create_rejects_a_malformed_dot() -> None:
    with pytest.raises(ValidationError):
        PathfinderCustomMapCreate.model_validate(map_body(dots=[{"row": 0}]))


def test_update_fields_are_all_optional() -> None:
    assert PathfinderCustomMapUpdate.model_validate({}) == PathfinderCustomMapUpdate()


def test_stored_map_defaults_to_unpublished_and_needs_a_server_timestamp() -> None:
    body = {**map_body(), "profile_id": 1}
    with pytest.raises(ValueError, match="set by the server"):
        PathfinderCustomMap.model_validate(body)
    assert PathfinderCustomMap.model_validate({**body, "created_at": START}).published is False
