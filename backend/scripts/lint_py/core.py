"""Shared types for the backend AST checks: one rule per `rule_*.py` module, each a
`check(source, project)` function that yields Violations whose message says where
the code should go instead."""

import ast
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass

from scripts.lint_py.naming import ModuleName, parse_module_filename


@dataclass(frozen=True)
class Violation:
    rule: str
    relpath: str
    line: int
    col: int
    message: str

    def render(self) -> str:
        return f"{self.relpath}:{self.line}:{self.col}: [{self.rule}] {self.message}"


@dataclass(frozen=True)
class Project:
    """What a rule may know about the rest of the tree: every backend-relative .py path."""

    relpaths: frozenset[str]
    legacy: frozenset[str]

    def is_checked(self, relpath: str) -> bool:
        return relpath not in self.legacy


@dataclass(frozen=True)
class SourceFile:
    relpath: str
    text: str
    tree: ast.Module

    @staticmethod
    def parse(relpath: str, text: str) -> "SourceFile":
        return SourceFile(relpath=relpath, text=text, tree=ast.parse(text, filename=relpath))

    @property
    def filename(self) -> str:
        return self.relpath.rsplit("/", 1)[-1]

    @property
    def is_app(self) -> bool:
        return self.relpath.startswith("app/")

    @property
    def is_test(self) -> bool:
        return self.relpath.startswith("tests/")

    @property
    def module_name(self) -> ModuleName | None:
        if not self.is_app:
            return None
        parsed = parse_module_filename(self.filename)
        return parsed if isinstance(parsed, ModuleName) else None


Rule = Callable[[SourceFile, Project], Iterable[Violation]]


def violation(rule: str, source: SourceFile, node: ast.AST | None, message: str) -> Violation:
    line = getattr(node, "lineno", 1)
    col = getattr(node, "col_offset", 0)
    return Violation(rule=rule, relpath=source.relpath, line=int(line), col=int(col) + 1, message=message)


def walk_module_scope(tree: ast.Module) -> Iterator[ast.AST]:
    """Every node that runs at import time: skips function and lambda bodies, keeps class bodies."""
    stack: list[ast.AST] = list(tree.body)
    while stack:
        node = stack.pop()
        yield node
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            stack.extend(node.decorator_list)
            stack.extend(d for d in (*node.args.defaults, *node.args.kw_defaults) if d is not None)
            continue
        if isinstance(node, ast.Lambda):
            continue
        stack.extend(ast.iter_child_nodes(node))


def called_name(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return None
