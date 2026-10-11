"""thin-routes: a *_routes_effect.py handler parses the request, calls the injected
service, and returns a response model. It never touches the database."""

import ast
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, violation
from scripts.lint_py.naming import DOCS

RULE: Final = "thin-routes"
DB_MODULES: Final = ("sqlalchemy", "sqlmodel", "sqlite3", "app.db")
DB_TYPES: Final = frozenset({"Session", "AsyncSession", "Connection", "Engine"})
DB_METHODS: Final = frozenset({"exec", "execute", "commit", "rollback", "scalars", "query", "flush"})


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    module = source.module_name
    if module is None or module.kind != "routes":
        return
    feature = source.relpath.split("/")[1]
    where = (
        f"Move it into app/{feature}/{feature}_repository_effect.py and reach it through the service "
        f"passed to bind_{feature}_routes(service=...). See {DOCS}#routes."
    )
    for node in ast.walk(source.tree):
        if isinstance(node, ast.Import | ast.ImportFrom):
            names = [node.module or ""] if isinstance(node, ast.ImportFrom) else [a.name for a in node.names]
            for name in names:
                if any(name == db or name.startswith(f"{db}.") for db in DB_MODULES):
                    yield violation(
                        RULE, source, node, f"Routes may not import `{name}`: handlers don't touch the DB. {where}"
                    )
        elif isinstance(node, ast.arg) and node.annotation is not None:
            annotation = ast.unparse(node.annotation)
            if any(
                part in DB_TYPES for part in annotation.replace("[", " ").replace("]", " ").replace(".", " ").split()
            ):
                yield violation(
                    RULE, source, node, f"Handler argument `{node.arg}: {annotation}` is a DB handle. {where}"
                )
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in DB_METHODS:
            yield violation(RULE, source, node, f"`.{node.func.attr}(...)` looks like DB access in a route. {where}")
