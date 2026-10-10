"""Todo orchestration: reads through the injected repository, applies the pure
reducers, writes back. Built once by assembly."""

from collections.abc import Sequence

from app.todo.todo_ports_pure import Clock, IdFactory, TodoNotFoundError, TodoRepository, TodoService
from app.todo.todo_reducers_pure import created, in_order, next_position, replaced, to_wire, updated
from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoUpdate


def make_todo_service(*, repository: TodoRepository, clock: Clock, new_id: IdFactory) -> TodoService:
    def list_todos() -> tuple[Todo, ...]:
        return tuple(to_wire(r) for r in in_order(repository.list_all()))

    def add_todo(draft: TodoCreate) -> Todo:
        record = created(draft, todo_id=new_id(), position=next_position(repository.list_all()), now=clock())
        repository.save(record)
        return to_wire(record)

    def update_todo(todo_id: TodoId, change: TodoUpdate) -> Todo:
        record = repository.get(todo_id)
        if record is None:
            raise TodoNotFoundError(todo_id)
        changed = updated(record, change)
        repository.save(changed)
        return to_wire(changed)

    def replace_todos(todos: Sequence[Todo]) -> tuple[Todo, ...]:
        repository.replace_all(replaced(todos, now=clock()))
        return list_todos()

    return TodoService(list_todos=list_todos, add_todo=add_todo, update_todo=update_todo, replace_todos=replace_todos)
