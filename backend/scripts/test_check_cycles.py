from pathlib import Path

from scripts.check_cycles import build_graph, find_cycles


def write(root: Path, relpath: str, text: str) -> None:
    path = root / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def test_value_cycle_is_reported(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/a.py", "from app import b\n")
    write(tmp_path, "app/b.py", "from app.a import thing\n")
    assert find_cycles(build_graph(tmp_path)) == [["app.a", "app.b"]]


def test_type_checking_cycle_is_allowed(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/a.py", "from app import b\n")
    write(tmp_path, "app/b.py", "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from app.a import A\n")
    assert find_cycles(build_graph(tmp_path)) == []


def test_function_level_import_still_counts(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/a.py", "import app.b\n")
    write(tmp_path, "app/b.py", "def f():\n    from app import a\n")
    assert find_cycles(build_graph(tmp_path)) == [["app.a", "app.b"]]


def test_relative_imports_resolve(tmp_path: Path) -> None:
    write(tmp_path, "app/__init__.py", "")
    write(tmp_path, "app/pkg/__init__.py", "")
    write(tmp_path, "app/pkg/a.py", "from . import b\n")
    write(tmp_path, "app/pkg/b.py", "from .a import x\n")
    assert find_cycles(build_graph(tmp_path)) == [["app.pkg.a", "app.pkg.b"]]


def test_the_real_backend_has_no_cycles() -> None:
    assert find_cycles(build_graph(Path(__file__).resolve().parents[1])) == []
