"""empty-init: a new-style `__init__.py` holds at most a docstring. No barrels, no
import-time side effects; import the concrete module instead."""

import ast
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, violation
from scripts.lint_py.naming import DOCS

RULE: Final = "empty-init"


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if source.filename != "__init__.py":
        return
    body = source.tree.body
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    if body:
        yield violation(
            RULE,
            source,
            body[0],
            "`__init__.py` must be empty (a docstring at most): no re-exports, no side effects. "
            f"Import the concrete module (app.<feature>.<module>) instead. See {DOCS}#file-naming.",
        )
