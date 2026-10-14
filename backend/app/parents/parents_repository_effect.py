"""SQL storage for parent accounts over an injected engine: the `parent` table and,
apart so it never rides along in a serialized parent, `parentpassword`. Rows are parsed
back through the records."""

from dataclasses import dataclass

from sqlalchemy import Column, DateTime, Engine, ForeignKey, Integer, MetaData, String, Table, delete, insert, select

from app.parents.parents_schemas_pure import NewParent, ParentRecord


@dataclass(frozen=True)
class SqlParentRepository:
    engine: Engine
    parents: Table
    passwords: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def list_all(self) -> tuple[ParentRecord, ...]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(self.parents).order_by(self.parents.c.id)).mappings().all()
        return tuple(ParentRecord.model_validate(dict(row)) for row in rows)

    def get(self, parent_id: int) -> ParentRecord | None:
        query = select(self.parents).where(self.parents.c.id == parent_id)
        with self.engine.connect() as connection:
            row = connection.execute(query).mappings().first()
        return None if row is None else ParentRecord.model_validate(dict(row))

    def insert(self, parent: NewParent) -> ParentRecord:
        with self.engine.begin() as connection:
            new_id = connection.execute(
                insert(self.parents).values(**parent.model_dump()).returning(self.parents.c.id)
            ).scalar_one()
        stored = self.get(int(new_id))
        if stored is None:
            msg = "parent vanished after insert"
            raise LookupError(msg)
        return stored

    def delete(self, parent_id: int) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.passwords).where(self.passwords.c.parent_id == parent_id))
            connection.execute(delete(self.parents).where(self.parents.c.id == parent_id))

    def password_hash(self, parent_id: int) -> str | None:
        query = select(self.passwords.c.password_hash).where(self.passwords.c.parent_id == parent_id)
        with self.engine.connect() as connection:
            found = connection.execute(query).scalar_one_or_none()
        return None if found is None else str(found)

    def set_password_hash(self, parent_id: int, password_hash: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.passwords).where(self.passwords.c.parent_id == parent_id))
            connection.execute(insert(self.passwords).values(parent_id=parent_id, password_hash=password_hash))


def make_sql_parent_repository(*, engine: Engine) -> SqlParentRepository:
    metadata = MetaData()
    parents = Table(
        "parent",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("name", String, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    passwords = Table(
        "parentpassword",
        metadata,
        Column("parent_id", Integer, ForeignKey("parent.id"), primary_key=True),
        Column("password_hash", String, nullable=False),
    )
    return SqlParentRepository(engine=engine, parents=parents, passwords=passwords, metadata=metadata)
