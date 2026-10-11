"""Pure pathfinder rules: validating maps, folding edits in, and shaping published rows.
The clock reading and author names arrive as arguments."""

from collections.abc import Mapping, Sequence
from datetime import datetime

from app.pathfinder.pathfinder_ports_pure import InvalidMapError
from app.pathfinder.pathfinder_schemas_pure import (
    PATHFINDER_DIFFICULTIES,
    GridPosition,
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
)


def new_completions(already: Sequence[str], level_ids: Sequence[str]) -> tuple[str, ...]:
    """The ids to record: each once, in request order, skipping ones already finished
    (so a replayed level keeps its original completion time)."""
    done = set(already)
    return tuple(level_id for level_id in dict.fromkeys(level_ids) if level_id not in done)


def created_map(profile_id: int, draft: PathfinderCustomMapCreate, *, now: datetime) -> PathfinderCustomMap:
    """Raises InvalidMapError (a 422) with the message the API returns."""
    if draft.difficulty not in PATHFINDER_DIFFICULTIES:
        msg = f"difficulty must be one of {PATHFINDER_DIFFICULTIES}"
        raise InvalidMapError(msg)
    name = _valid_name(draft.name)
    if not draft.dots:
        msg = "a map needs at least one dot"
        raise InvalidMapError(msg)
    return PathfinderCustomMap(
        id=draft.id,
        profile_id=profile_id,
        name=name,
        difficulty=draft.difficulty,
        rows=draft.rows,
        columns=draft.columns,
        dots=[dot.model_dump() for dot in draft.dots],
        published=False,
        created_at=now,
    )


def updated_map(custom_map: PathfinderCustomMap, change: PathfinderCustomMapUpdate) -> PathfinderCustomMap:
    """Rename and/or publish/unpublish. `id` and `created_at` never change."""
    name = custom_map.name if change.name is None else _valid_name(change.name)
    published = custom_map.published if change.published is None else change.published
    return custom_map.model_copy(update={"name": name, "published": published})


def published_rows(
    maps: Sequence[PathfinderCustomMap], author_names: Mapping[int, str]
) -> tuple[PublishedPathfinderMap, ...]:
    """Each published map with its builder's name. A map whose builder is gone is skipped."""
    return tuple(
        PublishedPathfinderMap(
            id=m.id,
            name=m.name,
            difficulty=m.difficulty,
            rows=m.rows,
            columns=m.columns,
            dots=[GridPosition.model_validate(dot) for dot in m.dots],
            author_profile_id=m.profile_id,
            author_name=author_names[m.profile_id],
            created_at=m.created_at,
        )
        for m in maps
        if m.profile_id in author_names
    )


def _valid_name(name: str) -> str:
    stripped = name.strip()
    if not stripped:
        msg = "name must not be empty"
        raise InvalidMapError(msg)
    return stripped
