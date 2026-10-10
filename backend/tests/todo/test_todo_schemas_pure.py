import pytest
from pydantic import ValidationError

from app.todo.todo_schemas_pure import Todo, TodoCreate


def test_title_is_trimmed() -> None:
    assert TodoCreate.model_validate({"title": "  feed the cat  "}).title == "feed the cat"


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_blank_or_overlong_titles_are_rejected(title: str) -> None:
    with pytest.raises(ValidationError):
        TodoCreate.model_validate({"title": title})


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        Todo.model_validate({"id": "a", "title": "t", "done": False, "extra": 1})
