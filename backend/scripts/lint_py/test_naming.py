import pytest

from scripts.lint_py.naming import Color, ModuleName, NamingProblem, parse_module_filename


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("todo_reducers_pure.py", ModuleName("todo", "reducers", Color.PURE)),
        ("pathfinder_map_repository_effect.py", ModuleName("pathfinder_map", "repository", Color.EFFECT)),
        ("app_wiring_assembly.py", ModuleName("app", "wiring", Color.ASSEMBLY)),
    ],
)
def test_valid_names_parse(filename: str, expected: ModuleName) -> None:
    assert parse_module_filename(filename) == expected


@pytest.mark.parametrize(
    ("filename", "fragment"),
    [
        ("todo.py", "must be named <basename>_<kind>_<color>.py"),
        ("todo_helpers_pure.py", "`helpers` is not a kind"),
        ("todo_routes_pure.py", "a `routes` module must be effect"),
        ("bind_store_service_effect.py", "`bind` is a reserved token"),
        ("todo_pure_schemas_pure.py", "`pure` is a reserved token"),
        ("TodoSchemas_schemas_pure.py", "must be named"),
    ],
)
def test_invalid_names_explain_the_fix(filename: str, fragment: str) -> None:
    result = parse_module_filename(filename)
    assert isinstance(result, NamingProblem)
    assert fragment in result.message
