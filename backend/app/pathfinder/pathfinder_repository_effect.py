"""SQL storage for pathfinder state over an injected engine. The tables keep the names
and columns the app has always used (`pathfinderlevelcompletion`,
`pathfindercustommap`), so existing databases work unchanged. Rows are parsed back
through the schemas at the boundary."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    ColumnElement,
    DateTime,
    Engine,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    delete,
    insert,
    select,
)

from app.pathfinder.pathfinder_schemas_pure import PathfinderCustomMap


@dataclass(frozen=True)
class SqlPathfinderRepository:
    engine: Engine
    completions: Table
    maps: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def completed_level_ids(self, profile_id: int) -> tuple[str, ...]:
        query = (
            select(self.completions.c.level_id)
            .where(self.completions.c.profile_id == profile_id)
            .order_by(self.completions.c.completed_at, self.completions.c.id)
        )
        with self.engine.connect() as connection:
            return tuple(str(level_id) for level_id in connection.execute(query).scalars())

    def completion_times(self, profile_id: int) -> tuple[datetime, ...]:
        """When each level was finished, oldest first."""
        query = (
            select(self.completions.c.completed_at)
            .where(self.completions.c.profile_id == profile_id)
            .order_by(self.completions.c.completed_at, self.completions.c.id)
        )
        with self.engine.connect() as connection:
            return tuple(connection.execute(query).scalars())

    def add_completions(self, profile_id: int, level_ids: Sequence[str], completed_at: datetime) -> None:
        if not level_ids:
            return
        rows = [
            {"profile_id": profile_id, "level_id": level_id, "completed_at": completed_at} for level_id in level_ids
        ]
        with self.engine.begin() as connection:
            connection.execute(insert(self.completions), rows)

    def list_maps(self, profile_id: int) -> tuple[PathfinderCustomMap, ...]:
        return self._maps(self.maps.c.profile_id == profile_id)

    def published_maps(self) -> tuple[PathfinderCustomMap, ...]:
        return self._maps(self.maps.c.published.is_(True))

    def get_map(self, map_id: str) -> PathfinderCustomMap | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(self.maps).where(self.maps.c.id == map_id)).mappings().first()
        return None if row is None else PathfinderCustomMap.model_validate(dict(row))

    def save_map(self, custom_map: PathfinderCustomMap) -> PathfinderCustomMap:
        with self.engine.begin() as connection:
            connection.execute(delete(self.maps).where(self.maps.c.id == custom_map.id))
            connection.execute(insert(self.maps).values(**custom_map.model_dump()))
        stored = self.get_map(custom_map.id)
        if stored is None:
            msg = f"map {custom_map.id} vanished after saving"
            raise LookupError(msg)
        return stored

    def delete_map(self, map_id: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.maps).where(self.maps.c.id == map_id))

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.completions).where(self.completions.c.profile_id == profile_id))
            connection.execute(delete(self.maps).where(self.maps.c.profile_id == profile_id))

    def _maps(self, condition: ColumnElement[bool]) -> tuple[PathfinderCustomMap, ...]:
        query = select(self.maps).where(condition).order_by(self.maps.c.created_at.desc())
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(PathfinderCustomMap.model_validate(dict(row)) for row in rows)


def make_sql_pathfinder_repository(*, engine: Engine) -> SqlPathfinderRepository:
    metadata = MetaData()
    completions = Table(
        "pathfinderlevelcompletion",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False, index=True),
        Column("level_id", String, nullable=False),
        Column("completed_at", DateTime, nullable=False),
        UniqueConstraint("profile_id", "level_id"),
    )
    maps = Table(
        "pathfindercustommap",
        metadata,
        Column("id", String, primary_key=True),
        Column("profile_id", Integer, nullable=False, index=True),
        Column("name", String, nullable=False),
        Column("difficulty", String, nullable=False),
        Column("rows", Integer, nullable=False),
        Column("columns", Integer, nullable=False),
        Column("dots", JSON),
        Column("published", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    return SqlPathfinderRepository(engine=engine, completions=completions, maps=maps, metadata=metadata)
