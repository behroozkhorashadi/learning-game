"""factory-in-function: no `bind_*`/`make_*`/`assemble_*` call at module scope. Calling one at
import time creates a global singleton that every importer shares and no test can replace."""

import ast
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, called_name, violation, walk_module_scope
from scripts.lint_py.naming import DOCS
from scripts.lint_py.rule_factory_discipline import ASSEMBLE, FACTORY

RULE: Final = "factory-in-function"


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if not project.is_checked(source.relpath):
        return
    for node in walk_module_scope(source.tree):
        if isinstance(node, ast.Call):
            name = called_name(node)
            if name is not None and (FACTORY.match(name) or ASSEMBLE.match(name)):
                yield violation(
                    RULE,
                    source,
                    node,
                    f"`{name}(...)` runs at import time and makes a module-level singleton. Call it inside "
                    f"assemble_app() in app/composition/app_wiring_assembly.py (or inside a test/fixture). "
                    f"See {DOCS}#factories.",
                )
