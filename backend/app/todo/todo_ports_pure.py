"""What the todo feature needs from the outside world, and the commands it offers.
Assembly supplies the implementations; tests supply fakes."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoRecord, TodoUpdate

Clock = Callable[[], datetime]
IdFactory = Callable[[], TodoId]


class TodoRepository(Protocol):
    """Hydrates and saves todos. Not a live cache: each call reads or writes storage."""

    def list_all(self) -> tuple[TodoRecord, ...]: ...

    def get(self, todo_id: TodoId) -> TodoRecord | None: ...

    def save(self, record: TodoRecord) -> None: ...

    def replace_all(self, records: Sequence[TodoRecord]) -> None: ...


class TodoNotFoundError(LookupError):
    def __init__(self, todo_id: TodoId) -> None:
        super().__init__(f"no todo with id {todo_id!r}")
        self.todo_id = todo_id


class DuplicateTodoIdError(ValueError):
    def __init__(self, todo_id: str) -> None:
        super().__init__(f"todo id {todo_id!r} appears more than once")
        self.todo_id = todo_id


@dataclass(frozen=True)
class TodoService:
    """Every command the routes may call. Adding one here makes every place that
    builds a TodoService fail to type-check until it supplies the command."""

    list_todos: Callable[[], tuple[Todo, ...]]
    add_todo: Callable[[TodoCreate], Todo]
    update_todo: Callable[[TodoId, TodoUpdate], Todo]
    replace_todos: Callable[[Sequence[Todo]], tuple[Todo, ...]]
