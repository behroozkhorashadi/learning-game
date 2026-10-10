"""SQL storage for todos over an injected SQLAlchemy engine. Rows are parsed back
through TodoRecord, so a bad row fails loudly here instead of downstream."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Boolean, Column, Engine, Integer, MetaData, String, Table, delete, insert, select

from app.todo.todo_schemas_pure import TodoId, TodoRecord


@dataclass(frozen=True)
class SqlTodoRepository:
    engine: Engine
    table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def list_all(self) -> tuple[TodoRecord, ...]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(self.table)).mappings().all()
        return tuple(TodoRecord.model_validate(dict(row)) for row in rows)

    def get(self, todo_id: TodoId) -> TodoRecord | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(self.table).where(self.table.c.id == todo_id)).mappings().first()
        return None if row is None else TodoRecord.model_validate(dict(row))

    def save(self, record: TodoRecord) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table).where(self.table.c.id == record.id))
            connection.execute(insert(self.table).values(**_row(record)))

    def replace_all(self, records: Sequence[TodoRecord]) -> None:
        with self.engine.begin() as connection:
            connection.execute(delete(self.table))
            if records:
                connection.execute(insert(self.table), [_row(r) for r in records])


def make_sql_todo_repository(*, engine: Engine) -> SqlTodoRepository:
    metadata = MetaData()
    table = Table(
        "example_todos",
        metadata,
        Column("id", String(64), primary_key=True),
        Column("title", String(200), nullable=False),
        Column("done", Boolean, nullable=False),
        Column("position", Integer, nullable=False),
        # ISO-8601 text keeps the UTC offset, which SQLite's DATETIME drops.
        Column("created_at", String(40), nullable=False),
    )
    return SqlTodoRepository(engine=engine, table=table, metadata=metadata)


def _row(record: TodoRecord) -> dict[str, object]:
    return {**record.model_dump(exclude={"created_at"}), "created_at": record.created_at.isoformat()}
