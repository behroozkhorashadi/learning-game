from scripts.lint_py.rule_no_suppressions import check
from scripts.lint_py.rule_testing import run_rule

PATH = "app/todo/todo_service_effect.py"


def test_noqa_fails() -> None:
    [message] = run_rule(check, PATH, "import os  # noqa: F401\n")
    assert "`# noqa` is banned" in message


def test_type_ignore_fails() -> None:
    [message] = run_rule(check, PATH, "x = f()  # type: ignore[attr-defined]\n")
    assert "`# type: ignore` is banned" in message


def test_pyright_ignore_needs_rule_and_reason() -> None:
    assert run_rule(check, PATH, "x = f()  # pyright: ignore\n") != []
    assert run_rule(check, PATH, "x = f()  # pyright: ignore[reportUnknownMemberType]\n") != []
    ok = "x = f()  # pyright: ignore[reportUnknownMemberType] -- grimp's metadata dict is untyped\n"
    assert run_rule(check, PATH, ok) == []


def test_file_level_pyright_override_fails() -> None:
    assert run_rule(check, PATH, "# pyright: basic\n") != []


def test_the_word_in_a_string_is_fine() -> None:
    assert run_rule(check, PATH, 'HELP = "never add # noqa"\n') == []
