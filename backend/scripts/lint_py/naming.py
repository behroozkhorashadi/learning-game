"""The backend filename grammar, in one place.

    app/<feature>/[<group>/]<basename>_<kind>_<color>.py

Every rule in scripts/lint_py and the `color_layers` import-linter contract
classify files through `parse_module_filename`. Changing the grammar or the
COLOR_RANK / KIND_COLORS tables means updating backend/AGENTS.md in the same PR.
"""

import re
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path
from typing import Final


class Color(IntEnum):
    """The layer. A module may import the same or a lower rank, never a higher one."""

    PURE = 0
    EFFECT = 1
    ASSEMBLY = 2


COLOR_BY_TOKEN: Final = {"pure": Color.PURE, "effect": Color.EFFECT, "assembly": Color.ASSEMBLY}

# The closed list of kinds, and the colors each kind may have.
KIND_COLORS: Final = {
    "schemas": frozenset({Color.PURE}),
    "reducers": frozenset({Color.PURE}),
    "ports": frozenset({Color.PURE}),
    "repository": frozenset({Color.EFFECT}),
    "client": frozenset({Color.EFFECT}),
    "service": frozenset({Color.EFFECT}),
    "routes": frozenset({Color.EFFECT}),
    "settings": frozenset({Color.ASSEMBLY}),
    "wiring": frozenset({Color.ASSEMBLY}),
}

# Kinds that hold only declarations (Protocols, a Settings model) and so don't
# need their own test module.
KINDS_WITHOUT_TESTS: Final = frozenset({"ports", "settings"})

RESERVED_TOKENS: Final = frozenset({*COLOR_BY_TOKEN, *KIND_COLORS, "bind", "make", "test", "assemble"})

# Directory names that group by kind instead of by feature.
KIND_NAMED_DIRS: Final = frozenset(
    {"models", "services", "utils", "helpers", "lib", "common", "schemas", "routes", "repositories", "types"}
)

_GRAMMAR: Final = re.compile(
    r"^(?P<basename>[a-z][a-z0-9]*(?:_[a-z0-9]+)*?)_(?P<kind>[a-z]+)_(?P<color>pure|effect|assembly)\.py$"
)
_MIN_FEATURE_DEPTH: Final = 3  # app/<feature>/<file>.py
_SNAKE: Final = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")

DOCS: Final = "backend/AGENTS.md"
# The ASGI entry (`uvicorn app.main:app`): `app = assemble_app(load_settings())` and nothing else.
ENTRY_POINT: Final = "app/main.py"
# Files allowed directly in app/: the package init (empty) and the entry point.
APP_ROOT_FILES: Final = frozenset({"app/__init__.py", ENTRY_POINT})
LEGACY_ALLOWLIST: Final = Path(__file__).resolve().parent / "legacy_allowlist.txt"


@dataclass(frozen=True)
class ModuleName:
    basename: str
    kind: str
    color: Color


@dataclass(frozen=True)
class NamingProblem:
    message: str


def is_snake_case(name: str) -> bool:
    return _SNAKE.fullmatch(name) is not None


def parse_module_filename(filename: str) -> ModuleName | NamingProblem:
    """Parses `todo_reducers_pure.py`. Returns a NamingProblem that says how to fix it."""
    match = _GRAMMAR.fullmatch(filename)
    if match is None:
        return NamingProblem(
            f"`{filename}` must be named <basename>_<kind>_<color>.py, e.g. todo_reducers_pure.py "
            f"(kind: {'|'.join(KIND_COLORS)}; color: pure|effect|assembly). See {DOCS}#file-naming."
        )
    basename, kind, color_token = match.group("basename"), match.group("kind"), match.group("color")
    color = COLOR_BY_TOKEN[color_token]
    if kind not in KIND_COLORS:
        return NamingProblem(
            f"`{filename}`: `{kind}` is not a kind. Use one of {'|'.join(KIND_COLORS)}. See {DOCS}#file-naming."
        )
    allowed = KIND_COLORS[kind]
    if color not in allowed:
        wanted = "|".join(c.name.lower() for c in sorted(allowed))
        return NamingProblem(
            f"`{filename}`: a `{kind}` module must be {wanted}, not {color_token}. "
            f"Rename it to {basename}_{kind}_{wanted}.py, or pick the kind that matches what it does. "
            f"See {DOCS}#file-naming."
        )
    reserved = [segment for segment in basename.split("_") if segment in RESERVED_TOKENS]
    if reserved:
        return NamingProblem(
            f"`{filename}`: `{reserved[0]}` is a reserved token and may only appear in its slot, "
            f"not in the basename. See {DOCS}#file-naming."
        )
    return ModuleName(basename=basename, kind=kind, color=color)


def load_legacy_allowlist(path: Path = LEGACY_ALLOWLIST) -> tuple[str, ...]:
    lines = (line.strip() for line in path.read_text().splitlines())
    return tuple(line for line in lines if line and not line.startswith("#"))


def module_path_to_relpath(module: str) -> str:
    """`app.todo.todo_reducers_pure` -> `app/todo/todo_reducers_pure.py` (packages map to __init__.py)."""
    return module.replace(".", "/") + ".py"


def feature_of(relpath: str) -> str | None:
    """`app/todo/x.py` -> `todo`; None for files directly under app/."""
    parts = relpath.split("/")
    if len(parts) < _MIN_FEATURE_DEPTH or parts[0] != "app":
        return None
    return parts[1]
