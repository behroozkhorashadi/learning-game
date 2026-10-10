"""Helper for the rule tests: run one rule over an in-memory file."""

from collections.abc import Iterable
from textwrap import dedent

from scripts.lint_py.core import Project, Rule, SourceFile


def run_rule(
    rule: Rule, relpath: str, text: str = "", *, others: Iterable[str] = (), legacy: Iterable[str] = ()
) -> list[str]:
    """Returns the messages `rule` reports for `relpath`; `others` are other files that exist."""
    source = SourceFile.parse(relpath, dedent(text))
    project = Project(relpaths=frozenset({relpath, *others}), legacy=frozenset(legacy))
    return [v.message for v in rule(source, project)]
