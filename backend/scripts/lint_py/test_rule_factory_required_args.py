from scripts.lint_py.rule_factory_required_args import check
from scripts.lint_py.rule_testing import run_rule

PATH = "app/todo/todo_service_effect.py"


def test_keyword_only_required_args_pass() -> None:
    assert run_rule(check, PATH, "def make_x(*, repo: Repo, clock: Clock) -> X:\n    ...\n") == []


def test_defaulted_arg_fails() -> None:
    [message] = run_rule(check, PATH, "def make_x(*, clock: Clock = now) -> X:\n    ...\n")
    assert "defaulted argument" in message


def test_positional_args_fail() -> None:
    [message] = run_rule(check, PATH, "def bind_x(repo: Repo) -> X:\n    ...\n")
    assert "Put `*` first" in message


def test_optional_dependency_fails() -> None:
    [message] = run_rule(check, PATH, "def make_x(*, repo: Repo | None) -> X:\n    ...\n")
    assert "optional (`| None`)" in message
    [legacy_style] = run_rule(check, PATH, "def make_x(*, repo: Optional[Repo]) -> X:\n    ...\n")
    assert "optional" in legacy_style


def test_capability_returning_optional_is_fine() -> None:
    assert run_rule(check, PATH, "def make_x(*, user: Callable[[], User | None]) -> X:\n    ...\n") == []


def test_varargs_fail() -> None:
    [message] = run_rule(check, PATH, "def make_x(*, a: A, **deps: D) -> X:\n    ...\n")
    assert "*args/**kwargs" in message
