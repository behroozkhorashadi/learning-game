"""The legacy allowlist can only shrink, and it stays in sync with the ruff/pyright
excludes in pyproject.toml."""

import tomllib
from pathlib import Path
from typing import Final

from scripts.lint_py.naming import load_legacy_allowlist

BACKEND_ROOT: Final = Path(__file__).resolve().parents[2]
# Lower this when you migrate a module. Never raise it: new code follows the new rules.
MAX_LEGACY_FILES: Final = 25


def test_allowlist_never_grows() -> None:
    assert len(load_legacy_allowlist()) <= MAX_LEGACY_FILES, (
        "legacy_allowlist.txt grew. New files follow backend/AGENTS.md; they are never allowlisted."
    )


def test_allowlist_is_tight() -> None:
    entries = load_legacy_allowlist()
    assert len(entries) == MAX_LEGACY_FILES, (
        f"You migrated {MAX_LEGACY_FILES - len(entries)} file(s): lower MAX_LEGACY_FILES to {len(entries)}."
    )


def test_every_entry_exists_and_is_unique() -> None:
    entries = load_legacy_allowlist()
    missing = [e for e in entries if not (BACKEND_ROOT / e).is_file()]
    assert missing == [], f"Remove deleted/migrated files from legacy_allowlist.txt: {missing}"
    assert len(set(entries)) == len(entries)


def test_ruff_and_pyright_exclude_exactly_the_legacy_files() -> None:
    config = tomllib.loads((BACKEND_ROOT / "pyproject.toml").read_text())
    legacy = set(load_legacy_allowlist())
    ruff_excludes = set(config["tool"]["ruff"]["extend-exclude"])
    pyright_excludes = {p for p in config["tool"]["pyright"]["exclude"] if p.endswith(".py")}
    assert ruff_excludes == legacy, "[tool.ruff] extend-exclude must list exactly legacy_allowlist.txt"
    assert pyright_excludes == legacy, "[tool.pyright] exclude must list exactly legacy_allowlist.txt"
