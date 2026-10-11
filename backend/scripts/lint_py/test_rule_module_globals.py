from scripts.lint_py.rule_module_globals import check
from scripts.lint_py.rule_testing import run_rule

PATH = "app/todo/todo_service_effect.py"


def test_immutable_constants_pass() -> None:
    text = """
        LIMIT = 3
        NAMES = ("a", "b")
        TodoId = NewType("TodoId", str)
        KINDS = frozenset({"a"})
        START = datetime(2026, 1, 1, tzinfo=UTC)
    """
    assert run_rule(check, PATH, text) == []


def test_mutable_literal_fails() -> None:
    [message] = run_rule(check, PATH, "CACHE: dict[str, int] = {}\n")
    assert "Module-level mutable value" in message


def test_constructed_client_fails() -> None:
    [message] = run_rule(check, PATH, "engine = create_engine(URL)\n")
    assert "`create_engine(...)` at module scope" in message


def test_global_statement_fails() -> None:
    [message] = run_rule(check, PATH, "def f():\n    global X\n")
    assert "`global`/`nonlocal`" in message


def test_the_entry_point_may_build_the_app_at_module_scope() -> None:
    text = "app = assemble_app(load_settings())\n"
    assert run_rule(check, "app/main.py", text) == []
    [message] = run_rule(check, "app/todo/todo_routes_effect.py", text)
    assert "at module scope" in message
