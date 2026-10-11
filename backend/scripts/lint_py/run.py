"""Runs every backend AST rule over app/, tests/, and scripts/. Usage (from backend/):

    .venv/bin/python -m scripts.lint_py.run [paths...]

With no paths, checks the whole tree. Exits 1 if any rule fires.
"""

import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Final

from scripts.lint_py import (
    rule_empty_init,
    rule_factory_discipline,
    rule_factory_in_function,
    rule_factory_required_args,
    rule_filename_grammar,
    rule_module_globals,
    rule_no_suppressions,
    rule_test_colocation,
    rule_thin_routes,
)
from scripts.lint_py.core import Project, Rule, SourceFile, Violation

BACKEND_ROOT: Final = Path(__file__).resolve().parents[2]
SCANNED_DIRS: Final = ("app", "tests", "scripts")
RULES: Final[tuple[Rule, ...]] = (
    rule_filename_grammar.check,
    rule_test_colocation.check,
    rule_empty_init.check,
    rule_factory_discipline.check,
    rule_factory_required_args.check,
    rule_factory_in_function.check,
    rule_module_globals.check,
    rule_thin_routes.check,
    rule_no_suppressions.check,
)


def collect_relpaths(root: Path) -> frozenset[str]:
    return frozenset(
        path.relative_to(root).as_posix() for folder in SCANNED_DIRS for path in (root / folder).rglob("*.py")
    )


def lint(root: Path, only: Sequence[str]) -> list[Violation]:
    project = Project(relpaths=collect_relpaths(root))
    targets = sorted(only) if only else sorted(project.relpaths)
    violations: list[Violation] = []
    for relpath in targets:
        source = SourceFile.parse(relpath, (root / relpath).read_text())
        for rule in RULES:
            violations.extend(rule(source, project))
    return violations


def main(argv: Sequence[str]) -> int:
    only = [Path(arg).resolve().relative_to(BACKEND_ROOT).as_posix() for arg in argv if arg.endswith(".py")]
    violations = lint(BACKEND_ROOT, only)
    for found in violations:
        sys.stdout.write(found.render() + "\n")
    if violations:
        sys.stdout.write(f"\nlint_py: {len(violations)} violation(s).\n")
        return 1
    sys.stdout.write("lint_py: ok\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
