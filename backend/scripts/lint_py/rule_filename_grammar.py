"""filename-grammar: every new-style module is app/<feature>/[<group>/]<basename>_<kind>_<color>.py,
in a feature folder (never a kind-named one), and every new-style test is
tests/<feature>/test_<module>.py."""

import re
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, violation
from scripts.lint_py.naming import (
    APP_ROOT_FILES,
    DOCS,
    KIND_NAMED_DIRS,
    NamingProblem,
    is_snake_case,
    parse_module_filename,
)

RULE: Final = "filename-grammar"
_ROOT_DEPTH: Final = 2
_TEST_FILE: Final = re.compile(r"^(test_[a-z0-9_]+|[a-z][a-z0-9_]*_fakes|conftest|__init__)\.py$")


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if not project.is_checked(source.relpath):
        return
    parts = source.relpath.split("/")
    if parts[0] == "app":
        yield from _check_app(source, parts)
    elif parts[0] == "tests":
        yield from _check_tests(source, parts)


def _check_app(source: SourceFile, parts: list[str]) -> Iterator[Violation]:
    if len(parts) == _ROOT_DEPTH:  # app/<file>.py
        if source.relpath in APP_ROOT_FILES:
            return
        yield violation(
            RULE,
            source,
            None,
            f"`{source.relpath}` sits directly in app/. Put it in a feature folder: "
            f"app/<feature>/<basename>_<kind>_<color>.py. See {DOCS}#file-naming.",
        )
        return
    for folder in parts[1:-1]:
        if folder in KIND_NAMED_DIRS or not is_snake_case(folder):
            yield violation(
                RULE,
                source,
                None,
                f"`app/{folder}/` is not a feature folder name. Group code by feature "
                f"(app/<feature>/), never by kind (models/, services/, utils/ ...); kind lives in "
                f"the filename. See {DOCS}#features.",
            )
            return
    if source.filename == "__init__.py":
        return
    parsed = parse_module_filename(source.filename)
    if isinstance(parsed, NamingProblem):
        yield violation(RULE, source, None, parsed.message)


def _check_tests(source: SourceFile, parts: list[str]) -> Iterator[Violation]:
    if source.filename in {"__init__.py", "conftest.py"}:
        return
    if len(parts) == _ROOT_DEPTH:  # tests/<file>.py
        yield violation(
            RULE,
            source,
            None,
            f"`{source.relpath}` sits directly in tests/. Put it next to its feature: "
            f"tests/<feature>/test_<module>.py. See {DOCS}#testing.",
        )
        return
    if _TEST_FILE.fullmatch(source.filename) is None:
        yield violation(
            RULE,
            source,
            None,
            f"`{source.filename}`: files in tests/<feature>/ are test_<module>.py, <name>_fakes.py, "
            f"or conftest.py. See {DOCS}#testing.",
        )
