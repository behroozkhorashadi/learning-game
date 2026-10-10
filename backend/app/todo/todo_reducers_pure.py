"""Pure todo transitions: records in, new records out. No I/O; the clock reading
and the new id arrive as arguments."""

from collections.abc import Sequence
from datetime import datetime

from app.todo.todo_ports_pure import DuplicateTodoIdError
from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoRecord, TodoUpdate


def in_order(records: Sequence[TodoRecord]) -> tuple[TodoRecord, ...]:
    return tuple(sorted(records, key=lambda r: (r.position, r.id)))


def next_position(records: Sequence[TodoRecord]) -> int:
    return max((r.position for r in records), default=-1) + 1


def created(draft: TodoCreate, *, todo_id: TodoId, position: int, now: datetime) -> TodoRecord:
    return TodoRecord(id=todo_id, title=draft.title, done=False, position=position, created_at=now)


def updated(record: TodoRecord, change: TodoUpdate) -> TodoRecord:
    return record.model_copy(update={"done": change.done})


def replaced(todos: Sequence[Todo], *, now: datetime) -> tuple[TodoRecord, ...]:
    """The whole list, in the client's order. Rejects a list that repeats an id."""
    seen: set[str] = set()
    for todo in todos:
        if todo.id in seen:
            raise DuplicateTodoIdError(todo.id)
        seen.add(todo.id)
    return tuple(
        TodoRecord(id=TodoId(t.id), title=t.title, done=t.done, position=i, created_at=now) for i, t in enumerate(todos)
    )


def to_wire(record: TodoRecord) -> Todo:
    return Todo(id=record.id, title=record.title, done=record.done)
