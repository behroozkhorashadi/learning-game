"""Fails when a feature folder exists in code but not in the architecture diagrams.

    python3 docs/architecture/check_coverage.py

Every directory under frontend/src/ that holds TypeScript must be named in
3-frontend.mmd, and every package under backend/app/ in 2-backend.mmd (as
`<name>/`, `src/<name>`, or `app/<name>`). That catches the commonest drift: a new feature
nobody drew. Whether the arrows are still right is judgment, so that part is
in docs/architecture/AGENTS.md and review-conventions.md, not here.
"""

import sys
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parent.parent

# (code root, diagram, file suffixes that make a directory "code")
TARGETS = (
    (REPO / "frontend" / "src", HERE / "3-frontend.mmd", (".ts", ".tsx")),
    (REPO / "backend" / "app", HERE / "2-backend.mmd", (".py",)),
)


def code_dirs(root: Path, suffixes: tuple[str, ...]) -> list[str]:
    """Top-level directories under `root` that contain code, at any depth."""
    return sorted(
        d.name
        for d in root.iterdir()
        if d.is_dir() and not d.name.startswith((".", "__")) and any(f.suffix in suffixes for f in d.rglob("*") if f.is_file())
    )


def missing(root: Path, diagram: Path, suffixes: tuple[str, ...]) -> list[str]:
    text = diagram.read_text()
    return [name for name in code_dirs(root, suffixes) if not any(form in text for form in (f"{name}/", f"src/{name}", f"app/{name}"))]


def main() -> int:
    problems = []
    for root, diagram, suffixes in TARGETS:
        for name in missing(root, diagram, suffixes):
            problems.append(
                f"{root.relative_to(REPO)}/{name}/ is not in docs/architecture/{diagram.name}. "
                f'Add a node for it (label it "{name}/"), with arrows for what it depends on and what uses it, '
                "then run `python3 docs/architecture/build.py`. See docs/architecture/AGENTS.md."
            )
    for p in problems:
        sys.stderr.write(p + "\n")
    if not problems:
        print("architecture diagrams: every feature folder is drawn")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
