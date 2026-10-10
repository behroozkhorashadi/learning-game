"""`color_layers` import-linter contract: the backend dependency matrix.

    assembly  may import assembly, effect, pure (and legacy modules)
    effect    may import effect, pure
    pure      may import pure, plus an allowlist of side-effect-free libraries

Plus: features never import each other (assembly wires them), new-style code never
imports a legacy module (migrate it first), and only app.main (the legacy entry) or
assembly may import assembly. Classification is by filename (scripts/lint_py/naming.py);
import-linter's stock wildcards can only match whole module names, not a `_pure` suffix.

`find_violations` is plain data in, data out so it can be tested without grimp.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Final, override

from grimp import ImportGraph
from importlinter import Contract, ContractCheck, output

from scripts.lint_py.naming import (
    DOCS,
    Color,
    ModuleName,
    load_legacy_allowlist,
    module_path_to_relpath,
    parse_module_filename,
)

LEGACY_ENTRY: Final = "app.main"
_FEATURE_MODULE_DEPTH: Final = 3  # app.<feature>.<module>

# Third-party and stdlib packages a pure module may import: no I/O, no clock, no env.
PURE_EXTERNALS: Final = frozenset(
    {
        "__future__",
        "abc",
        "annotated_types",
        "collections",
        "dataclasses",
        "datetime",
        "decimal",
        "enum",
        "fractions",
        "functools",
        "itertools",
        "math",
        "operator",
        "pydantic",
        "pydantic_core",
        "re",
        "string",
        "types",
        "typing",
        "typing_extensions",
    }
)


@dataclass(frozen=True)
class Edge:
    importer: str
    imported: str
    line: int


@dataclass(frozen=True)
class Problem:
    edge: Edge
    message: str


def classify(module: str, legacy: frozenset[str]) -> ModuleName | str:
    """A ModuleName for new-style modules; 'legacy', 'package', or 'entry' otherwise."""
    if module == LEGACY_ENTRY:
        return "entry"
    relpath = module_path_to_relpath(module)
    if relpath in legacy or f"{module.replace('.', '/')}/__init__.py" in legacy:
        return "legacy"
    parsed = parse_module_filename(relpath.rsplit("/", 1)[-1])
    return parsed if isinstance(parsed, ModuleName) else "package"


def _feature(module: str) -> str | None:
    parts = module.split(".")
    return parts[1] if len(parts) >= _FEATURE_MODULE_DEPTH else None


def find_violations(edges: Iterable[Edge], first_party: frozenset[str], legacy: frozenset[str]) -> list[Problem]:
    problems: list[Problem] = []
    for edge in edges:
        source = classify(edge.importer, legacy)
        if not isinstance(source, ModuleName):
            if source in {"legacy", "package"} and edge.imported in first_party:
                target = classify(edge.imported, legacy)
                if isinstance(target, ModuleName) and target.color is Color.ASSEMBLY:
                    problems.append(Problem(edge, _msg_assembly_import(edge)))
            continue
        if edge.imported not in first_party:
            top = edge.imported.split(".")[0]
            if source.color is Color.PURE and top not in PURE_EXTERNALS:
                problems.append(
                    Problem(
                        edge,
                        f"{edge.importer} is pure and may not import `{edge.imported}` (I/O, env, clock, or "
                        f"framework). Put that code in an *_effect.py module behind a Protocol in "
                        f"*_ports_pure.py, and pass the result in as data. See {DOCS}#layers.",
                    )
                )
            continue
        target = classify(edge.imported, legacy)
        if target in {"legacy", "entry"}:
            if source.color is not Color.ASSEMBLY:
                problems.append(
                    Problem(
                        edge,
                        f"{edge.importer} imports legacy module {edge.imported}. New-style code depends only on "
                        f"new-style code: migrate it (see backend/MIGRATION.md) or have assembly adapt it and "
                        f"inject a narrow callable. See {DOCS}#legacy.",
                    )
                )
            continue
        if not isinstance(target, ModuleName):
            continue
        if target.color > source.color:
            problems.append(
                Problem(
                    edge,
                    f"{edge.importer} ({source.color.name.lower()}) may not import {edge.imported} "
                    f"({target.color.name.lower()}): dependencies point down "
                    f"(assembly -> effect -> pure). Receive what you need as a factory argument instead. "
                    f"See {DOCS}#layers.",
                )
            )
            continue
        importer_feature, imported_feature = _feature(edge.importer), _feature(edge.imported)
        if source.color is not Color.ASSEMBLY and importer_feature != imported_feature:
            problems.append(
                Problem(
                    edge,
                    f"{edge.importer} imports another feature ({edge.imported}). Features never import each "
                    f"other: declare the capability you need as a Protocol in your own *_ports_pure.py and "
                    f"let app/composition/app_wiring_assembly.py pass the other feature's implementation. "
                    f"See {DOCS}#features.",
                )
            )
    return problems


def _msg_assembly_import(edge: Edge) -> str:
    return (
        f"{edge.importer} imports assembly module {edge.imported}. Nothing imports assembly except "
        f"assembly and the app.main entry point. See {DOCS}#layers."
    )


def graph_edges(graph: ImportGraph, root: str) -> tuple[list[Edge], frozenset[str]]:
    first_party = frozenset(m for m in graph.modules if m == root or m.startswith(f"{root}."))
    edges: list[Edge] = []
    for importer in sorted(first_party):
        for imported in sorted(graph.find_modules_directly_imported_by(importer)):
            details = graph.get_import_details(importer=importer, imported=imported)
            line = min((d["line_number"] for d in details), default=0)
            edges.append(Edge(importer=importer, imported=imported, line=line))
    return edges, first_party


class ColorLayersContract(Contract):
    @override
    def check(self, graph: ImportGraph, verbose: bool) -> ContractCheck:
        edges, first_party = graph_edges(graph, "app")
        problems = find_violations(edges, first_party, frozenset(load_legacy_allowlist()))
        rendered = [f"{p.edge.importer} -> {p.edge.imported} (l.{p.edge.line}): {p.message}" for p in problems]
        return ContractCheck(kept=not problems, metadata={"report": "\n\n".join(rendered)})

    @override
    def render_broken_contract(self, check: ContractCheck) -> None:
        report = check.metadata.get("report")
        if isinstance(report, str):
            output.print_error(report, bold=False)
            output.new_line()
