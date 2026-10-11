from scripts.lint_py.rule_filename_grammar import check
from scripts.lint_py.rule_testing import run_rule


def test_well_named_feature_module_passes() -> None:
    assert run_rule(check, "app/todo/todo_reducers_pure.py") == []
    assert run_rule(check, "app/todo/__init__.py") == []


def test_module_without_suffix_fails() -> None:
    [message] = run_rule(check, "app/todo/helpers.py")
    assert "<basename>_<kind>_<color>.py" in message


def test_new_file_directly_in_app_fails() -> None:
    [message] = run_rule(check, "app/new_thing_service_effect.py")
    assert "feature folder" in message


def test_kind_named_folder_fails() -> None:
    [message] = run_rule(check, "app/services/todo_service_effect.py")
    assert "never by kind" in message


def test_legacy_files_are_skipped() -> None:
    assert run_rule(check, "app/db.py", legacy=["app/db.py"]) == []


def test_tests_live_in_feature_folders() -> None:
    assert run_rule(check, "tests/todo/test_todo_reducers_pure.py") == []
    assert run_rule(check, "tests/todo/todo_fakes.py") == []
    [root] = run_rule(check, "tests/test_new.py")
    assert "tests/<feature>/test_<module>.py" in root
    [odd] = run_rule(check, "tests/todo/helpers.py")
    assert "test_<module>.py, <name>_fakes.py" in odd


def test_only_the_package_init_and_the_entry_point_sit_directly_in_app() -> None:
    assert run_rule(check, "app/__init__.py") == []
    assert run_rule(check, "app/main.py", "app = assemble_app(load_settings())\n") == []
    [message] = run_rule(check, "app/server.py")
    assert "feature folder" in message
