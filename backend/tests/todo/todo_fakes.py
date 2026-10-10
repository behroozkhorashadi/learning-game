"""Fakes for the todo feature's injected capabilities: an in-memory repository, a
clock you advance by hand, and sequential ids. Pass them to the real factories."""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from app.todo.todo_schemas_pure import TodoId, TodoRecord

START = datetime(2026, 1, 1, 9, 0, tzinfo=UTC)


class InMemoryTodoRepository:
    def __init__(self, records: Sequence[TodoRecord] = ()) -> None:
        self.records: dict[TodoId, TodoRecord] = {r.id: r for r in records}

    def list_all(self) -> tuple[TodoRecord, ...]:
        return tuple(self.records.values())

    def get(self, todo_id: TodoId) -> TodoRecord | None:
        return self.records.get(todo_id)

    def save(self, record: TodoRecord) -> None:
        self.records[record.id] = record

    def replace_all(self, records: Sequence[TodoRecord]) -> None:
        self.records = {r.id: r for r in records}


class ManualClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: int) -> None:
        self.now += timedelta(seconds=seconds)


class SequentialIds:
    def __init__(self) -> None:
        self.count = 0

    def __call__(self) -> TodoId:
        self.count += 1
        return TodoId(f"todo-{self.count}")


def record(todo_id: str, title: str, *, position: int, done: bool = False) -> TodoRecord:
    return TodoRecord(id=TodoId(todo_id), title=title, done=done, position=position, created_at=START)
