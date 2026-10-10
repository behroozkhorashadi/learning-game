from scripts.lint_py.rule_test_colocation import check
from scripts.lint_py.rule_testing import run_rule


def test_module_with_its_test_passes() -> None:
    assert run_rule(check, "app/todo/todo_reducers_pure.py", others=["tests/todo/test_todo_reducers_pure.py"]) == []


def test_module_without_a_test_fails_and_names_the_file_to_add() -> None:
    [message] = run_rule(check, "app/todo/todo_reducers_pure.py")
    assert "Add `tests/todo/test_todo_reducers_pure.py`" in message


def test_ports_and_settings_need_no_test() -> None:
    assert run_rule(check, "app/todo/todo_ports_pure.py") == []
    assert run_rule(check, "app/composition/app_settings_assembly.py") == []


def test_orphaned_test_fails() -> None:
    [message] = run_rule(check, "tests/todo/test_todo_gone_pure.py")
    assert "`app/todo/todo_gone_pure.py`, which doesn't exist" in message


def test_root_level_test_is_left_to_filename_grammar() -> None:
    assert run_rule(check, "tests/test_new.py") == []
