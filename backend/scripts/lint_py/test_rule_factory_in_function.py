from scripts.lint_py.rule_factory_in_function import check
from scripts.lint_py.rule_testing import run_rule


def test_module_level_factory_call_fails() -> None:
    [message] = run_rule(check, "app/composition/app_wiring_assembly.py", "service = make_todo_service(repository=r)\n")
    assert "module-level singleton" in message


def test_module_level_call_in_a_test_fails() -> None:
    assert run_rule(check, "tests/todo/test_x.py", "SERVICE = make_todo_service(repository=r)\n") != []


def test_call_inside_a_function_passes() -> None:
    text = "def assemble_app():\n    return make_todo_service(repository=r)\n"
    assert run_rule(check, "app/composition/app_wiring_assembly.py", text) == []


def test_decorator_and_default_count_as_module_scope() -> None:
    assert run_rule(check, "tests/todo/test_x.py", "def f(x=bind_x(a=1)):\n    pass\n") != []


def test_the_entry_point_builds_the_app_at_import() -> None:
    assert run_rule(check, "app/main.py", "app = assemble_app(load_settings())\n") == []
    assert run_rule(check, "app/todo/todo_routes_effect.py", "app = assemble_app(load_settings())\n") != []
