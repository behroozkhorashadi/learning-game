"""Fails if the backend has a runtime (value) import cycle. Mirrors the frontend's
scripts/check_cycles.ts:

- builds the first-party import graph of app/ from the AST (no imports executed);
- drops imports under `if TYPE_CHECKING:`, so type-only cycles stay allowed;
- keeps imports inside functions: a deferred import hides a cycle, it doesn't remove it;
- runs Tarjan's SCC over the value edges and reports every cycle.

    .venv/bin/python scripts/check_cycles.py        # from backend/
"""

import ast
import sys
from collections.abc import Iterator, Mapping, Set
from pathlib import Path
from typing import Final

BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
PACKAGE: Final = "app"


def module_name(root: Path, path: Path) -> str:
    parts = list(path.relative_to(root).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _is_type_checking(test: ast.expr) -> bool:
    return (isinstance(test, ast.Name) and test.id == "TYPE_CHECKING") or (
        isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"
    )


def _value_imports(node: ast.AST) -> Iterator[ast.Import | ast.ImportFrom]:
    for child in ast.iter_child_nodes(node):
        if isinstance(child, ast.If) and _is_type_checking(child.test):
            for stmt in child.orelse:
                yield from _value_imports_stmt(stmt)
            continue
        if isinstance(child, ast.Import | ast.ImportFrom):
            yield child
        yield from _value_imports(child)


def _value_imports_stmt(stmt: ast.stmt) -> Iterator[ast.Import | ast.ImportFrom]:
    if isinstance(stmt, ast.Import | ast.ImportFrom):
        yield stmt
    yield from _value_imports(stmt)


def _resolve_from(current: str, is_package: bool, node: ast.ImportFrom) -> str:
    if node.level == 0:
        return node.module or ""
    base = current.split(".") if is_package else current.split(".")[:-1]
    base = base[: len(base) - (node.level - 1)]
    return ".".join([*base, node.module] if node.module else base)


def build_graph(root: Path, package: str = PACKAGE) -> dict[str, set[str]]:
    files = {module_name(root, p): p for p in sorted((root / package).rglob("*.py"))}
    graph: dict[str, set[str]] = {m: set() for m in files}
    for current, path in files.items():
        is_package = path.name == "__init__.py"
        for node in _value_imports(ast.parse(path.read_text(), filename=str(path))):
            if isinstance(node, ast.Import):
                targets = [alias.name for alias in node.names]
            else:
                origin = _resolve_from(current, is_package, node)
                targets = [f"{origin}.{a.name}" if f"{origin}.{a.name}" in files else origin for a in node.names]
            for target in targets:
                resolved = _longest_known_prefix(target, files.keys())
                if resolved is not None and resolved != current:
                    graph[current].add(resolved)
    return graph


def _longest_known_prefix(target: str, known: Set[str]) -> str | None:
    parts = target.split(".")
    while parts:
        candidate = ".".join(parts)
        if candidate in known:
            return candidate
        parts.pop()
    return None


def find_cycles(graph: Mapping[str, Set[str]]) -> list[list[str]]:
    """Tarjan's strongly connected components; returns those with more than one module."""
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    on_stack: set[str] = set()
    stack: list[str] = []
    cycles: list[list[str]] = []
    counter = 0

    def visit(node: str) -> None:
        nonlocal counter
        index[node] = low[node] = counter
        counter += 1
        stack.append(node)
        on_stack.add(node)
        for neighbor in sorted(graph.get(node, ())):
            if neighbor not in index:
                visit(neighbor)
                low[node] = min(low[node], low[neighbor])
            elif neighbor in on_stack:
                low[node] = min(low[node], index[neighbor])
        if low[node] == index[node]:
            component: list[str] = []
            while True:
                member = stack.pop()
                on_stack.discard(member)
                component.append(member)
                if member == node:
                    break
            if len(component) > 1:
                cycles.append(sorted(component))

    for node in sorted(graph):
        if node not in index:
            visit(node)
    return sorted(cycles)


def main() -> int:
    cycles = find_cycles(build_graph(BACKEND_ROOT))
    for cycle in cycles:
        sys.stdout.write(
            "Import cycle: " + " -> ".join([*cycle, cycle[0]]) + "\n"
            "  Break it by moving the shared piece into a lower-layer *_pure.py module, or by injecting\n"
            "  the dependency from app/composition/. Type-only imports can go under `if TYPE_CHECKING:`.\n"
            "  See backend/AGENTS.md#layers.\n"
        )
    if cycles:
        return 1
    sys.stdout.write("check_cycles: no value import cycles\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
