"""SQL storage for the armory ledger, the art gallery, and the saved looks over an injected engine. Rows are parsed back
through ArmoryEntry, so a bad row fails loudly here instead of downstream."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Column, Engine, Integer, MetaData, String, Table, Text, delete, insert, select

from app.armory.armory_schemas_pure import ArmoryEntry, ArmoryLooks, ArtPiece


@dataclass(frozen=True)
class SqlArmoryRepository:
    engine: Engine
    table: Table
    art: Table
    looks: Table
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

    def list_art(self, profile_id: int) -> tuple[ArtPiece, ...]:
        query = select(self.art).where(self.art.c.profile_id == profile_id).order_by(self.art.c.created_at.desc())
        with self.engine.connect() as connection:
            rows = connection.execute(query).mappings().all()
        return tuple(ArtPiece.model_validate(dict(row)) for row in rows)

    def add_art(self, piece: ArtPiece) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                insert(self.art).values(
                    **piece.model_dump(exclude={"created_at"}), created_at=piece.created_at.isoformat()
                )
            )

    def looks_for(self, profile_id: int) -> ArmoryLooks | None:
        query = select(self.looks.c.looks).where(self.looks.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            stored = connection.execute(query).scalar_one_or_none()
        return None if stored is None else ArmoryLooks.model_validate_json(str(stored))

    def save_looks(self, profile_id: int, looks: ArmoryLooks) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.looks).where(self.looks.c.profile_id == profile_id))
            connection.execute(insert(self.looks).values(profile_id=profile_id, looks=looks.model_dump_json()))

    def delete_for_profile(self, profile_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.profile_id == profile_id))
            connection.execute(delete(self.art).where(self.art.c.profile_id == profile_id))
            connection.execute(delete(self.looks).where(self.looks.c.profile_id == profile_id))


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
    art = Table(
        "armory_art",
        metadata,
        Column("id", String(64), primary_key=True),
        Column("profile_id", Integer, nullable=False, index=True),
        Column("image_url", String(200), nullable=False),
        Column("style", String(32), nullable=False),
        Column("idea", String(200), nullable=False),
        Column("created_at", String(40), nullable=False),
    )
    # One row per profile: its looks as JSON, parsed back through ArmoryLooks.
    looks = Table(
        "armory_looks",
        metadata,
        Column("profile_id", Integer, primary_key=True, autoincrement=False),
        Column("looks", Text, nullable=False),
    )
    return SqlArmoryRepository(engine=engine, table=table, art=art, looks=looks, metadata=metadata)


def _row(entry: ArmoryEntry) -> dict[str, object]:
    return {**entry.model_dump(exclude={"created_at"}), "created_at": entry.created_at.isoformat()}
