"""Tests for check_coverage.py (run: backend/.venv/bin/pytest docs/architecture)."""

from pathlib import Path

from check_coverage import code_dirs, missing


def _tree(tmp_path: Path) -> Path:
    root = tmp_path / "src"
    (root / "profiles").mkdir(parents=True)
    (root / "profiles" / "a.pure.ui.tsx").write_text("")
    (root / "styles").mkdir()
    (root / "styles" / "tokens.css").write_text("")
    (root / "__pycache__").mkdir()
    return root


def test_code_dirs_skips_dirs_without_code(tmp_path: Path) -> None:
    assert code_dirs(_tree(tmp_path), (".ts", ".tsx")) == ["profiles"]


def test_missing_reports_an_undrawn_feature(tmp_path: Path) -> None:
    diagram = tmp_path / "d.mmd"
    diagram.write_text('flowchart TB\n  x["session/"]')
    assert missing(_tree(tmp_path), diagram, (".tsx",)) == ["profiles"]


def test_missing_accepts_either_spelling(tmp_path: Path) -> None:
    diagram = tmp_path / "d.mmd"
    root = _tree(tmp_path)
    for label in ("app/profiles (assembly)", "Legacy - src/profiles", "profiles/ picker"):
        diagram.write_text(f'flowchart TB\n  x["{label}"]')
        assert missing(root, diagram, (".tsx",)) == [], label
