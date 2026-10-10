"""test-colocation: every new-style app module has tests/<feature>/test_<module>.py, and
every new-style test file names a module that exists (no orphaned tests)."""

from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation, violation
from scripts.lint_py.naming import DOCS, KINDS_WITHOUT_TESTS

RULE: Final = "test-colocation"


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    if not project.is_checked(source.relpath):
        return
    module = source.module_name
    if module is not None and module.kind not in KINDS_WITHOUT_TESTS:
        expected = _test_path_for(source.relpath)
        if expected not in project.relpaths:
            yield violation(
                RULE,
                source,
                None,
                f"`{source.relpath}` has no tests. Add `{expected}` that drives it through its "
                f"factory with fakes (see tests/todo/ for the pattern). See {DOCS}#testing.",
            )
    # A test directly in tests/ is reported by filename-grammar.
    if source.is_test and source.filename.startswith("test_") and source.relpath.count("/") > 1:
        target = _module_path_for(source.relpath)
        if target not in project.relpaths:
            yield violation(
                RULE,
                source,
                None,
                f"`{source.relpath}` should test `{target}`, which doesn't exist. Name the test "
                f"test_<module>.py after the module it covers, in tests/<feature>/. See {DOCS}#testing.",
            )


def _test_path_for(app_relpath: str) -> str:
    folders, filename = app_relpath.removeprefix("app/").rsplit("/", 1)
    return f"tests/{folders}/test_{filename}"


def _module_path_for(test_relpath: str) -> str:
    folders, filename = test_relpath.removeprefix("tests/").rsplit("/", 1)
    return f"app/{folders}/{filename.removeprefix('test_')}"
