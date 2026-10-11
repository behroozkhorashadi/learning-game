"""factory-required-args: a `bind_*`/`make_*` factory takes only required, keyword-only,
non-optional dependencies. A default (`clock=datetime.now`) or an `X | None` dependency
hides what the factory needs from every assembly point."""

import ast
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, violation
from scripts.lint_py.naming import DOCS
from scripts.lint_py.rule_factory_discipline import FACTORY

RULE: Final = "factory-required-args"


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if source.is_test:
        return
    for node in ast.walk(source.tree):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and FACTORY.match(node.name):
            yield from _check_factory(source, node)


def _check_factory(source: SourceFile, node: ast.FunctionDef | ast.AsyncFunctionDef) -> Iterator[Violation]:
    args = node.args
    hint = f"Make every dependency a required keyword-only argument and pass it from assembly. See {DOCS}#factories."
    if args.posonlyargs or args.args:
        yield violation(
            RULE,
            source,
            node,
            f"`{node.name}` takes positional arguments. Put `*` first: def {node.name}(*, ...). {hint}",
        )
    if args.vararg is not None or args.kwarg is not None:
        yield violation(RULE, source, node, f"`{node.name}` takes *args/**kwargs, which hides its dependencies. {hint}")
    defaults = [*args.defaults, *(d for d in args.kw_defaults if d is not None)]
    if defaults:
        yield violation(RULE, source, defaults[0], f"`{node.name}` has a defaulted argument. {hint}")
    for arg in [*args.posonlyargs, *args.args, *args.kwonlyargs]:
        if arg.annotation is not None and _is_optional(arg.annotation):
            yield violation(
                RULE,
                source,
                arg,
                f"`{node.name}` argument `{arg.arg}` is optional (`| None`). Inject a real capability, "
                f"or a no-op one chosen in assembly. {hint}",
            )


def _is_optional(annotation: ast.expr) -> bool:
    if isinstance(annotation, ast.BinOp) and isinstance(annotation.op, ast.BitOr):
        return any(_is_none(side) or _is_optional(side) for side in (annotation.left, annotation.right))
    if isinstance(annotation, ast.Subscript):
        target = annotation.value
        name = target.id if isinstance(target, ast.Name) else target.attr if isinstance(target, ast.Attribute) else ""
        return name == "Optional"
    return False


def _is_none(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and node.value is None
