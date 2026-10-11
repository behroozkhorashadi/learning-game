# Backend (FastAPI) — agent guide

The backend version of the repo-wide guardrails (root `AGENTS.md`, `DEPENDENCIES.md`).
**To add a feature, copy `app/todo/` + `tests/todo/` and wire it in
`app/composition/app_wiring_assembly.py`.** Every rule below fails the build. Each error
message names where the code goes and links a section of this file.

## Preflight

```
backend/scripts/preflight.sh        # ruff, ruff format, pyright strict, lint-imports, lint_py, cycles, pytest (~5s)
backend/scripts/precommit.sh FILES  # the fast staged-files subset the pre-commit hook runs
.venv/bin/python scripts/export_openapi.py OUT.json   # OpenAPI schema for the FE's generated types
```

Setup: `make install-backend`, then `uv pip install --python .venv -r requirements-dev.txt`.

## File naming

```
app/<feature>/[<group>/]<basename>_<kind>_<color>.py        e.g. app/todo/todo_reducers_pure.py
tests/<feature>/[<group>/]test_<same filename>.py           e.g. tests/todo/test_todo_reducers_pure.py
tests/<feature>/<name>_fakes.py, conftest.py                fakes and fixtures for that feature
```

Python module names can't contain dots, so the FE's `.<color>.<kind>` becomes a
`_<kind>_<color>` suffix. `basename` is snake_case. The kind comes from a closed list, and
each kind allows certain colors:

| kind | color | what it holds |
|---|---|---|
| `schemas` | pure | pydantic models: the wire contract and stored records |
| `reducers` | pure | state transitions: records in, records out; clock/id readings arrive as args |
| `ports` | pure | `Protocol`s for injected capabilities, the service command type, domain errors |
| `repository` | effect | storage over an injected engine/session factory |
| `client` | effect | external API clients over an injected `httpx` client |
| `service` | effect | orchestration: `make_<x>_service(*, repository, clock, new_id)` |
| `routes` | effect | `bind_<x>_routes(*, service) -> APIRouter`, thin handlers |
| `settings` | assembly | `AppSettings` (pydantic-settings) |
| `wiring` | assembly | `assemble_*` functions |

Reserved tokens (`pure effect assembly bind make test assemble` plus every kind) can't
appear as basename segments. `__init__.py` files are empty: no barrels, no side effects.
Import the concrete module, using absolute imports everywhere (ruff `TID252`).

| wrong | right |
|---|---|
| `app/services/todo.py` | `app/todo/todo_service_effect.py` |
| `app/todo/helpers.py` | name it after its kind: `app/todo/todo_reducers_pure.py` |
| `app/todo/todo_routes_pure.py` | routes are effect: `todo_routes_effect.py` |
| `tests/test_todo.py` | `tests/todo/test_todo_service_effect.py` |
| `from app.todo import Todo` (barrel) | `from app.todo.todo_schemas_pure import Todo` |

Every module except `ports` and `settings` needs its test file, and every test file must
name a module that exists (`test-colocation`).

## Features

`app/<feature>/` is the unit of ownership and deletion. Folders never group by kind
(`models/`, `services/`, `utils/` are rejected). **Features never import each other.** If
todo needs something from notes, declare the capability as a `Protocol` in
`todo_ports_pure.py`, and let assembly pass the notes implementation in. Only assembly sees
across features. This keeps every feature deletable as a unit.

## Layers

```
assembly  wires the graph: reads settings, creates engines/clients, picks implementations
effect    needs injection: built by a bind_/make_ factory over injected handles
pure      no injection, no I/O: same input -> same output
```

| from \ may import | assembly | effect | pure | legacy (unmigrated) |
|---|:-:|:-:|:-:|:-:|
| assembly | ✅ | ✅ | ✅ | ✅ |
| effect | ❌ | ✅ | ✅ | ❌ |
| pure | ❌ | ❌ | ✅ | ❌ |
| legacy | ❌ (only `app.main`) | ✅ | ✅ | ✅ |

Pure modules may import only `pydantic`, `typing`, `dataclasses`, `enum`, `datetime` (the
types, not `now()`), `collections`, `functools`, `itertools`, `math`, `re`, `decimal`, and
the other entries in `PURE_EXTERNALS` (`scripts/lint_py/color_contract.py`). They can't import
`sqlalchemy`, `httpx`, `fastapi`, `os`, or `pydantic_settings`.

Enforced by `lint-imports` (pyproject `[tool.importlinter]`): the custom `color_layers`
contract classifies modules by filename, a stock `layers` contract keeps
`app.main > app.composition > features`, and a `forbidden` contract stops legacy packages
from importing composition. When you add a feature package, add it to the `layers` contract's
bottom layer (`"app.todo | app.notes"`).

Runtime import cycles fail `scripts/check_cycles.py`. Type-only imports under
`if TYPE_CHECKING:` are allowed to cycle. A function-level import still counts.

## Factories

- `bind_*` (returns a router) and `make_*` (returns a service, repository, or client) are
  **declared only in `*_effect.py`** and **invoked only in `*_assembly.py`**, inside an
  `assemble_*` function. A factory body may call other factories. Tests may call anything.
- Arguments are **keyword-only, required, and non-optional**: `def make_x(*, repository: R, clock: Clock)`.
  No defaults (`clock=datetime.now` hides a dependency) and no `X | None` dependencies. Pass
  a no-op implementation chosen in assembly instead.
- **Never at module scope.** `service = make_x(...)` at import time is a global singleton.
- Per-request data are route/handler parameters. Construction-time capabilities (repository,
  clock, id factory, HTTP client) are factory arguments.
- Inject the **narrowest capability**: `Callable[[], datetime]`, not a settings object;
  `TodoRepository` (a 4-method Protocol), not an engine.

## Assembly

`app/composition/` is the only place that reads `AppSettings`, creates engines and HTTP
clients, reads feature flags, picks implementations, and calls factories. See
`app/composition/AGENTS.md`. Ruff bans `os.environ`/`os.getenv`/`dotenv` everywhere else.
Feature flags are `AppSettings` fields read in assembly, and code below receives their
effect (a mounted router or not, a chosen implementation), never the flag.

`fastapi.Depends` is banned outside assembly. Routes get their service through the
`bind_<x>_routes(service=...)` closure, which is the Python version of the FE's `bind*`.
If you need a `Depends` provider (auth, say), define and register it in assembly. Tests
override through the factory args, not `app.dependency_overrides`.

## Purity

Ruff `banned-api` blocks `datetime.now/utcnow/today`, `date.today`, `time.time`,
`uuid.uuid1/uuid4`, `random`, `requests`, and `unittest.mock.patch` everywhere except
`*_assembly.py` (and tooling in `scripts/`). Inject `clock: Callable[[], datetime]` and
`new_id: Callable[[], XId]`; assembly passes `lambda: datetime.now(UTC)` and
`lambda: XId(uuid4().hex)`.

## State

No module-level mutable values (list/dict/set literals), no module-level construction (an
engine, client, router, or cache), and no `global`/`nonlocal` (`module-globals`).
Immutable constants (numbers, strings, tuples, `frozenset`, `NewType`, `datetime(...)`) are
fine. State lives in objects a factory returns. **One writer per durable value:** the
repository hydrates and saves; nothing keeps a second cached copy.

## Routes

`*_routes_effect.py` handlers parse (FastAPI validates the pydantic body), call the
injected service, and return a response model (the return annotation). They never import
`sqlalchemy`/`sqlmodel`/`app.db`, never take a `Session`, and never call
`.execute/.commit/...` (`thin-routes`). Map domain errors (from `*_ports_pure.py`) to
`HTTPException` there. Business logic goes in reducers; I/O goes in the repository.

## Parse at the door

Anything from outside, whether a request body, a DB row, an external API response, env,
or a queue message, goes through pydantic before it's used: `Model.model_validate(raw)`,
`AppSettings()` for env. `typing.cast` is banned. Models use
`ConfigDict(frozen=True, extra="forbid")`. The repository re-parses rows into `TodoRecord`,
so a bad row fails at the boundary instead of downstream.

## Testing

Test at the typed seam (copy `tests/todo/`):

| seam | how |
|---|---|
| schemas | `Model.model_validate(...)`: accepted and rejected inputs |
| reducers | plain calls with literal records |
| repository | the real repository on a `tmp_path` SQLite engine |
| service | `make_x_service` with `todo_fakes.py`: in-memory repo, `ManualClock`, `SequentialIds` |
| routes | `bind_x_routes(service=make_x_service(<fakes>))` on a bare `FastAPI()`, typed as `httpx.Client` |
| composition | `tests/composition/test_app_wiring_assembly.py` boots `assemble_app(AppSettings(...))` on a real SQLite file |

- Assert **observable results** (responses, what a later `list` returns), not which internal
  method was called.
- Fake the external capability, not the behavior under test. A fake that always succeeds
  hides the failure path, so give fakes a way to fail when you test failure.
- **No `mock.patch`** (banned). If you need to patch, the dependency should have been an
  argument.
- Type `TestClient` values as `httpx.Client`. Starlette's own annotations don't resolve
  under pyright strict.

## Suppressions

Exceptions are architecture changes. `# noqa` and `# type: ignore` are banned
(`no-suppressions`; pyright's `enableTypeIgnoreComments = false`). As a last resort,
`# pyright: ignore[reportX] -- reason (10+ chars)` is accepted. The right fix is to move the
code, or to change the rule in `pyproject.toml` / `scripts/lint_py/` openly in a PR.

## Legacy

Everything that existed before these rules is listed in
`scripts/lint_py/legacy_allowlist.txt` (65 files) and excluded from ruff, pyright strict,
and the AST rules. New-style code may not import legacy modules, so migrate what you need or
adapt it in assembly. The list can only shrink (`test_legacy_allowlist.py`). See
`MIGRATION.md`. `app/main.py` is the legacy entry point (`uvicorn app.main:app`). It calls
`assemble_features(app, load_settings())` to mount new-style routers.
