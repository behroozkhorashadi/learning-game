import pytest

from app.todo.todo_ports_pure import TodoNotFoundError, TodoService
from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoUpdate
from app.todo.todo_service_effect import make_todo_service
from tests.todo.todo_fakes import InMemoryTodoRepository, ManualClock, SequentialIds


@pytest.fixture
def repository() -> InMemoryTodoRepository:
    return InMemoryTodoRepository()


@pytest.fixture
def service(repository: InMemoryTodoRepository) -> TodoService:
    return make_todo_service(repository=repository, clock=ManualClock(), new_id=SequentialIds())


def test_added_todos_are_listed_in_the_order_they_were_added(service: TodoService) -> None:
    service.add_todo(TodoCreate(title="first"))
    service.add_todo(TodoCreate(title="second"))
    assert service.list_todos() == (
        Todo(id="todo-1", title="first", done=False),
        Todo(id="todo-2", title="second", done=False),
    )


def test_marking_done_is_persisted(service: TodoService, repository: InMemoryTodoRepository) -> None:
    added = service.add_todo(TodoCreate(title="x"))
    service.update_todo(TodoId(added.id), TodoUpdate(done=True))
    assert repository.records[TodoId(added.id)].done is True


def test_updating_a_missing_todo_raises(service: TodoService) -> None:
    with pytest.raises(TodoNotFoundError):
        service.update_todo(TodoId("nope"), TodoUpdate(done=True))


def test_replace_overwrites_the_whole_list(service: TodoService) -> None:
    service.add_todo(TodoCreate(title="old"))
    incoming = [Todo(id="b", title="b", done=True), Todo(id="a", title="a", done=False)]
    assert service.replace_todos(incoming) == tuple(incoming)
    assert service.list_todos() == tuple(incoming)
