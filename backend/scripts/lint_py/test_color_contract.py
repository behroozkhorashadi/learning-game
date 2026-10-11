import pytest

from scripts.lint_py.color_contract import Edge, find_violations

FIRST_PARTY = frozenset(
    {
        "app",
        "app.main",
        "app.db",
        "app.todo",
        "app.todo.todo_schemas_pure",
        "app.todo.todo_service_effect",
        "app.todo.todo_routes_effect",
        "app.notes.notes_schemas_pure",
        "app.composition.app_wiring_assembly",
    }
)


def problems(importer: str, imported: str) -> list[str]:
    return [p.message for p in find_violations([Edge(importer, imported, 1)], FIRST_PARTY)]


@pytest.mark.parametrize(
    ("importer", "imported"),
    [
        ("app.todo.todo_service_effect", "app.todo.todo_schemas_pure"),
        ("app.composition.app_wiring_assembly", "app.todo.todo_service_effect"),
        ("app.composition.app_wiring_assembly", "app.notes.notes_schemas_pure"),
        ("app.main", "app.composition.app_wiring_assembly"),
        ("app.todo.todo_schemas_pure", "pydantic"),
        ("app.todo.todo_service_effect", "sqlalchemy"),
    ],
)
def test_allowed_edges(importer: str, imported: str) -> None:
    assert problems(importer, imported) == []


def test_pure_may_not_import_effect() -> None:
    [message] = problems("app.todo.todo_schemas_pure", "app.todo.todo_service_effect")
    assert "dependencies point down" in message


def test_effect_may_not_import_assembly() -> None:
    [message] = problems("app.todo.todo_service_effect", "app.composition.app_wiring_assembly")
    assert "may not import" in message


def test_pure_may_not_import_io_libraries() -> None:
    for library in ("sqlalchemy", "httpx", "os", "fastapi", "pydantic_settings"):
        [message] = problems("app.todo.todo_schemas_pure", library)
        assert "is pure and may not import" in message


def test_features_do_not_import_each_other() -> None:
    [message] = problems("app.todo.todo_service_effect", "app.notes.notes_schemas_pure")
    assert "Features never import each other" in message


def test_features_may_not_import_the_entry_point() -> None:
    [message] = problems("app.todo.todo_service_effect", "app.main")
    assert "imports the entry point app.main" in message


def test_a_package_may_not_import_assembly() -> None:
    [message] = problems("app.todo", "app.composition.app_wiring_assembly")
    assert "Nothing imports assembly" in message
