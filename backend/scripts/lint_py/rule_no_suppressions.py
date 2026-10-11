"""no-suppressions: exceptions are architecture changes. `# noqa` and `# type: ignore` are
banned; a `# pyright: ignore[rule]` needs the rule code and a written reason after it."""

import io
import re
import tokenize
from collections.abc import Iterator
from typing import Final

from scripts.lint_py.core import Project, SourceFile, Violation

RULE: Final = "no-suppressions"
_NOQA: Final = re.compile(r"#\s*noqa\b", re.IGNORECASE)
_TYPE_IGNORE: Final = re.compile(r"#\s*type:\s*ignore", re.IGNORECASE)
_PYRIGHT_FILE: Final = re.compile(r"#\s*pyright:\s*(basic|standard|strict|report\w+\s*=)", re.IGNORECASE)
_PYRIGHT_IGNORE: Final = re.compile(r"#\s*pyright:\s*ignore(?P<rules>\[[\w, ]+\])?(?P<reason>.*)$", re.IGNORECASE)
_REASON: Final = re.compile(r"^\s*(--|-|:)\s*\S.{9,}")
_HOW: Final = (
    "Exceptions are architecture changes: move the code, or change the rule in backend/pyproject.toml "
    "openly in review. See backend/AGENTS.md#suppressions."
)


def check(source: SourceFile, project: Project) -> Iterator[Violation]:
    tokens = tokenize.generate_tokens(io.StringIO(source.text).readline)
    for token in tokens:
        if token.type != tokenize.COMMENT:
            continue
        line, col = token.start
        comment = token.string
        message: str | None = None
        if _NOQA.search(comment):
            message = f"`# noqa` is banned. {_HOW}"
        elif _TYPE_IGNORE.search(comment):
            message = f"`# type: ignore` is banned. {_HOW}"
        elif _PYRIGHT_FILE.search(comment):
            message = f"File-level pyright overrides are banned. {_HOW}"
        elif (match := _PYRIGHT_IGNORE.search(comment)) is not None and (
            match.group("rules") is None or _REASON.match(match.group("reason")) is None
        ):
            message = (
                "`# pyright: ignore` needs the rule and a reason: "
                "`# pyright: ignore[reportFoo] -- why this is safe`. Prefer fixing the type."
            )
        if message is not None:
            yield Violation(rule=RULE, relpath=source.relpath, line=line, col=col + 1, message=message)
