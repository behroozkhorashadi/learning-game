from scripts.lint_py.rule_empty_init import check
from scripts.lint_py.rule_testing import run_rule


def test_empty_or_docstring_only_init_passes() -> None:
    assert run_rule(check, "app/todo/__init__.py", "") == []
    assert run_rule(check, "app/todo/__init__.py", '"""Todo feature."""\n') == []


def test_barrel_init_fails() -> None:
    [message] = run_rule(check, "app/todo/__init__.py", "from app.todo.todo_schemas_pure import Todo\n")
    assert "Import the concrete module" in message
