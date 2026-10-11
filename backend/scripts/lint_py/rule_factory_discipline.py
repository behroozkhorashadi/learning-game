"""factory-discipline: `bind_*`/`make_*` factories are declared only in *_effect.py and
invoked only in *_assembly.py (a factory body may call other factories; tests may
construct anything). `assemble_*` is declared and invoked only in *_assembly.py."""

import ast
import re
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, called_name, violation
from scripts.lint_py.naming import DOCS, ENTRY_POINT, Color

RULE: Final = "factory-discipline"
FACTORY: Final = re.compile(r"^(bind|make)_[a-z0-9_]+$")
ASSEMBLE: Final = re.compile(r"^assemble_[a-z0-9_]+$")


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if source.is_test or not source.is_app:
        return
    module = source.module_name
    color = module.color if module is not None else None
    yield from _visit(source, source.tree, color, inside_factory=False)


def _visit(source: SourceFile, node: ast.AST, color: Color | None, *, inside_factory: bool) -> Iterator[Violation]:
    for child in ast.iter_child_nodes(node):
        child_inside = inside_factory
        if isinstance(child, ast.FunctionDef | ast.AsyncFunctionDef):
            if FACTORY.match(child.name):
                child_inside = True
                if color is not Color.EFFECT:
                    yield violation(
                        RULE,
                        source,
                        child,
                        f"`{child.name}` is a factory, and factories are declared only in *_effect.py. "
                        f"Move it to app/<feature>/<basename>_<kind>_effect.py. See {DOCS}#factories.",
                    )
            elif ASSEMBLE.match(child.name) and color is not Color.ASSEMBLY:
                yield violation(
                    RULE,
                    source,
                    child,
                    f"`{child.name}` wires the graph and belongs in app/composition/*_assembly.py. "
                    f"See {DOCS}#factories.",
                )
        if isinstance(child, ast.Call):
            name = called_name(child)
            if name is not None and FACTORY.match(name) and color is not Color.ASSEMBLY and not inside_factory:
                yield violation(
                    RULE,
                    source,
                    child,
                    f"`{name}(...)` is invoked outside assembly. Take what it builds as an argument "
                    f"of your own factory, and call `{name}` from assemble_* in "
                    f"app/composition/app_wiring_assembly.py. See {DOCS}#factories.",
                )
            if (
                name is not None
                and ASSEMBLE.match(name)
                and color is not Color.ASSEMBLY
                and source.relpath != ENTRY_POINT
            ):
                yield violation(
                    RULE,
                    source,
                    child,
                    f"`{name}(...)` may only be called from assembly (or the app/main.py entry point). "
                    f"See {DOCS}#factories.",
                )
        yield from _visit(source, child, color, inside_factory=child_inside)
