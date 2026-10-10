import pytest

from app.todo.todo_ports_pure import DuplicateTodoIdError
from app.todo.todo_reducers_pure import created, in_order, next_position, replaced, to_wire, updated
from app.todo.todo_schemas_pure import Todo, TodoCreate, TodoId, TodoUpdate
from tests.todo.todo_fakes import START, record


def test_created_todo_starts_not_done_with_the_given_id_and_time() -> None:
    result = created(TodoCreate(title="read"), todo_id=TodoId("t1"), position=3, now=START)
    assert (result.id, result.title, result.done, result.position, result.created_at) == ("t1", "read", False, 3, START)


def test_next_position_follows_the_highest_existing_one() -> None:
    assert next_position([]) == 0
    assert next_position([record("a", "a", position=4), record("b", "b", position=1)]) == 5


def test_in_order_sorts_by_position() -> None:
    ordered = in_order([record("b", "b", position=1), record("a", "a", position=0)])
    assert [r.id for r in ordered] == ["a", "b"]


def test_updated_returns_a_new_record_and_leaves_the_old_one() -> None:
    before = record("a", "a", position=0)
    after = updated(before, TodoUpdate(done=True))
    assert (before.done, after.done) == (False, True)


def test_replaced_keeps_the_clients_order() -> None:
    todos = [Todo(id="z", title="last", done=True), Todo(id="a", title="first", done=False)]
    assert [to_wire(r) for r in in_order(replaced(todos, now=START))] == todos


def test_replaced_rejects_repeated_ids() -> None:
    with pytest.raises(DuplicateTodoIdError):
        replaced([Todo(id="a", title="1", done=False), Todo(id="a", title="2", done=False)], now=START)
