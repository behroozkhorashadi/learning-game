"""module-globals: no mutable or constructed state at module scope. Module-level lists,
dicts, sets, `global`, and calls (an engine, a client, a router, a cache) are shared
by every importer; build them inside a factory and inject them instead."""

import ast
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, called_name, violation
from scripts.lint_py.naming import DOCS

RULE: Final = "module-globals"
# Calls whose result is immutable and carries no I/O.
ALLOWED_CALLS: Final = frozenset(
    {
        *("NewType", "TypeVar", "ParamSpec", "TypeVarTuple"),
        *("frozenset", "tuple", "MappingProxyType", "compile"),
        *("datetime", "date", "timedelta", "Decimal", "Fraction"),
    }
)
_MUTABLE: Final = (ast.List, ast.Dict, ast.Set, ast.ListComp, ast.DictComp, ast.SetComp)


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if not project.is_checked(source.relpath) or not (source.is_app or source.is_test):
        return
    for node in ast.walk(source.tree):
        if isinstance(node, ast.Global | ast.Nonlocal):
            yield violation(
                RULE,
                source,
                node,
                "`global`/`nonlocal` mutates shared state. Keep state in an object a factory returns. "
                f"See {DOCS}#state.",
            )
    for statement in source.tree.body:
        value = _assigned_value(statement)
        if value is None:
            continue
        if isinstance(value, _MUTABLE):
            yield violation(
                RULE,
                source,
                statement,
                "Module-level mutable value. Use an immutable one (tuple, frozenset, "
                f"MappingProxyType) or build it inside a factory. See {DOCS}#state.",
            )
        elif isinstance(value, ast.Call) and called_name(value) not in ALLOWED_CALLS:
            yield violation(
                RULE,
                source,
                statement,
                f"`{called_name(value) or 'call'}(...)` at module scope constructs shared state at import time. "
                f"Construct it in assembly (app/composition/app_wiring_assembly.py) and inject it. See {DOCS}#state.",
            )


def _assigned_value(statement: ast.stmt) -> ast.expr | None:
    if isinstance(statement, ast.Assign):
        return statement.value
    if isinstance(statement, ast.AnnAssign):
        return statement.value
    if isinstance(statement, ast.AugAssign):
        return statement.value
    return None
