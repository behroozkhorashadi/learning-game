"""SQL storage for the armory ledger over an injected engine. Rows are parsed back
through ArmoryEntry, so a bad row fails loudly here instead of downstream."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Column, Engine, Integer, MetaData, String, Table, delete, insert, select

from app.armory.armory_schemas_pure import ArmoryEntry


@dataclass(frozen=True)
class SqlArmoryRepository:
    engine: Engine
    table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def entries_for(self, profile_id: int) -> tuple[ArmoryEntry, ...]:
        query = select(self.table).where(self.table.c.profile_id == profile_id).order_by(self.table.c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(ArmoryEntry.model_validate({k: v for k, v in row.items() if k != "id"}) for row in rows)

    def append(self, entries: Sequence[ArmoryEntry]) -> None:
        if not entries:
            return
        with self.engine.begin() as connection:
            connection.execute(insert(self.table), [_row(entry) for entry in entries])

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))


def make_sql_armory_repository(*, engine: Engine) -> SqlArmoryRepository:
    metadata = MetaData()
    table = Table(
        "armory_ledger",
        metadata,
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("profile_id", Integer, nullable=False, index=True),
        Column("kind", String(20), nullable=False),
        Column("item_id", String(64), nullable=True),
        Column("points", Integer, nullable=False),
        Column("quantity", Integer, nullable=False),
        # ISO-8601 text keeps the UTC offset, which SQLite's DATETIME drops.
        Column("created_at", String(40), nullable=False),
    )
    return SqlArmoryRepository(engine=engine, table=table, metadata=metadata)


def _row(entry: ArmoryEntry) -> dict[str, object]:
    return {**entry.model_dump(exclude={"created_at"}), "created_at": entry.created_at.isoformat()}
