from scripts.lint_py.rule_factory_discipline import check
from scripts.lint_py.rule_testing import run_rule


def test_factory_declared_in_effect_passes() -> None:
    assert (
        run_rule(check, "app/todo/todo_service_effect.py", "def make_todo_service(*, repo):\n    return repo\n") == []
    )


def test_factory_declared_in_pure_fails() -> None:
    [message] = run_rule(check, "app/todo/todo_reducers_pure.py", "def make_thing(*, x):\n    return x\n")
    assert "declared only in *_effect.py" in message


def test_factory_invoked_outside_assembly_fails() -> None:
    text = "def handler(repo):\n    return make_todo_service(repository=repo)\n"
    [message] = run_rule(check, "app/todo/todo_routes_effect.py", text)
    assert "invoked outside assembly" in message


def test_factory_may_compose_other_factories() -> None:
    text = "def bind_page(*, repo):\n    return make_todo_service(repository=repo)\n"
    assert run_rule(check, "app/todo/todo_routes_effect.py", text) == []


def test_assembly_may_invoke_factories() -> None:
    text = "def assemble_app(settings):\n    return make_todo_service(repository=settings)\n"
    assert run_rule(check, "app/composition/app_wiring_assembly.py", text) == []


def test_assemble_outside_assembly_fails() -> None:
    [declared] = run_rule(check, "app/todo/todo_service_effect.py", "def assemble_todo():\n    pass\n")
    assert "app/composition/*_assembly.py" in declared


def test_tests_may_construct_anything() -> None:
    assert run_rule(check, "tests/todo/test_x.py", "def test_it():\n    make_todo_service(repository=1)\n") == []
