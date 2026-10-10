from scripts.lint_py.rule_testing import run_rule
from scripts.lint_py.rule_thin_routes import check

PATH = "app/todo/todo_routes_effect.py"


def test_route_calling_a_service_passes() -> None:
    assert run_rule(check, PATH, "def bind_todo_routes(*, service):\n    return service.list_todos()\n") == []


def test_db_import_fails_and_names_the_repository() -> None:
    [message] = run_rule(check, PATH, "from sqlmodel import Session\n")
    assert "app/todo/todo_repository_effect.py" in message


def test_session_argument_fails() -> None:
    [message] = run_rule(check, PATH, "def list_todos(session: Session) -> None:\n    pass\n")
    assert "is a DB handle" in message


def test_db_method_call_fails() -> None:
    [message] = run_rule(check, PATH, "def f(x):\n    x.commit()\n")
    assert "looks like DB access" in message


def test_non_route_modules_are_not_checked() -> None:
    assert run_rule(check, "app/todo/todo_repository_effect.py", "from sqlalchemy import select\n") == []
