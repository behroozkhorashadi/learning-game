"""SQL storage for practice configs over an injected engine. The table keeps the name
and columns the app has always used (`practiceconfig`), so existing databases work
unchanged. Rows are parsed back through PracticeConfig at the boundary."""

from dataclasses import dataclass

from sqlalchemy import (
    JSON,
    Column,
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
    update,
)

from app.practice.practice_schemas_pure import PracticeConfig


@dataclass(frozen=True)
class SqlPracticeConfigRepository:
    engine: Engine
    table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def get(self, profile_id: int, game_id: str) -> PracticeConfig | None:
        query = select(self.table).where(self.table.c.profile_id == profile_id, self.table.c.game_id == game_id)
        with self.engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return None if row is None else PracticeConfig.model_validate(dict(row))

    def save(self, config: PracticeConfig) -> PracticeConfig:
        values = config.model_dump(exclude={"id"})
        with self.engine.begin() as connection:
            if config.id is None:
                connection.execute(insert(self.table).values(**values))
            else:
                connection.execute(update(self.table).where(self.table.c.id == config.id).values(**values))
        stored = self.get(config.profile_id, config.game_id)
        if stored is None:
            msg = f"practice config for profile {config.profile_id}/{config.game_id} vanished after saving"
            raise LookupError(msg)
        return stored

    def delete(self, profile_id: int, game_id: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                delete(self.table).where(self.table.c.profile_id == profile_id, self.table.c.game_id == game_id)
            )

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))


def make_sql_practice_config_repository(*, engine: Engine) -> SqlPracticeConfigRepository:
    metadata = MetaData()
    table = Table(
        "practiceconfig",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("operations", JSON),
        Column("focus_numbers", JSON),
        Column("difficulty", Integer, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        UniqueConstraint("profile_id", "game_id"),
    )
    return SqlPracticeConfigRepository(engine=engine, table=table, metadata=metadata)
