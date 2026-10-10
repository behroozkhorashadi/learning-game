# Adaptive Learning Games

Full spec: `PRD_adaptive_learning_games.md`. A FastAPI backend (`backend/`) and a Vite +
React + TypeScript frontend (`frontend/`). Most code here is written by coding agents, and
machines, not reviewers, keep it in shape. This README is the *why*. The *how* is in
[AGENTS.md](AGENTS.md).

## Setup and commands

```
make install-backend    # backend/.venv with runtime + dev tooling (ruff, pyright, import-linter)
make install-frontend   # npm install in frontend/ (Node 22, see frontend/.nvmrc)
make install-hooks      # pre-commit hook: lint + format on staged files only

make dev                # backend (:8000) + frontend (Vite) together. One command, Ctrl-C stops both
make preflight          # every check CI runs, FE + BE + API contract
make gen-api            # regenerate frontend/src/api/ types from the backend's OpenAPI
make e2e                # on-demand Playwright happy paths (own temp DB, ports 8100/5174; not in CI)
make help               # everything else (asset generators, gen-types, ...)
```

## Philosophy

Someone with a small task and no full picture of the app should still do the right thing
by default. **The obvious local change must also be the correct one.**

1. **The right way is the easy way.** If a shortcut would be wrong, make it *harder* than
   doing it properly, not just discouraged.
2. **The computer enforces the rules, not memory.** A rule that matters fails the build. A
   blocked PR is cheap. Drift multiplied across many contributors and agents is how
   codebases rot.
3. **Trust comes from verification.** A green typecheck proves shape, not behavior. Anyone,
   human or agent, can start the app in one command (`make dev`), drive it, see what really
   happens, and fix their own mistake.
4. **Consistency is the feature.** Agents pattern-match on nearby code. Uniform code means
   the copied pattern is right by default. Boring and familiar beats clever every time.

### Why this matters now

When PRs are nearly free, the bottleneck moves from writing code to safely merging it.
Merge throughput is limited by CI turnaround and code quality. Agents start with fresh
context every time, so the codebase has to be discoverable without tribal knowledge: clear
boundaries, consistent patterns, explicit dependencies, and statically enforced structure.

| Group | Question | Levers |
|---|---|---|
| Direction | Are we building the right thing? | explicit intent, acceptance criteria per task |
| Structure | Can agents change the system safely? | discoverable code, static analysis, lint, architecture, simplification |
| Verification | Can we trust the change? | behavioral tests, regression protection, trustworthy checks, fast CI |
| Flow | Can we integrate efficiently? | small focused PRs, limits on work in progress, fast feedback |
| Learning | Does it work in production? | observability, feature flags, staged rollout, fast rollback |

Two corollaries:

- **Verification must be trustworthy, not just green.** An agent can write an
  implementation and tests that share the same wrong assumption. Tests assert observable
  behavior against independently stated acceptance criteria, not against the implementation.
- **Code is cheap to write but expensive to own.** Prefer deleting and simplifying.
  Features are deletable as a unit.

### Three levels of guardrails

Every rule is pushed to the highest level it can live at.

1. **Architecture.** Shape the code so the wrong move can't be written. With no setter,
   there's no way to mutate behind everyone's back. Where the language can't prevent it
   (e.g. `fetch` from a component), a custom lint rule (`frontend/scripts/lint/`,
   `backend/scripts/lint_py/`, import-linter) stands in for the missing wall.
2. **Types and compiler.** Maximally strict (`tsc` strict, `pyright --strict`), so a wrong
   shape, an unhandled null, an unsafe cast, or a missing switch case fails the build.
3. **Agent docs.** Nested `AGENTS.md` files where agents read them, plus a worked example
   to copy (`frontend/src/examples/todo/`, `backend/app/todo/`). This level is the softest,
   so it exists to make the right path obvious *before* anyone hits a wall.

Every lint and type error message says **where the code should go instead** and links the
doc that explains it, so a violation can be fixed from the message alone.

## Guiding principles

### Locally obvious == globally correct

The component's signature tells you everything it needs.

```tsx
// Good: the dependency is in the interface; a missing one is a compile error at assembly.
export function bindTodos({ repository, createId, backup }: TodosDeps): ComponentType

// Poor: looks self-contained, silently needs a provider somewhere up the tree.
export function Todos() { const repo = useContext(RepoContext) /* … */ }
```

### The shortest path is the correct path

```ts
// Good: the narrow handle is one line in assembly.
bindTodoRepository({ storage: { getItem: (k) => localStorage.getItem(k), setItem: … }, key })

// Poor (and a lint error outside assembly): reaching for the global where you need it.
const saved = localStorage.getItem('todos')
```

### Mechanism over memory

```jsonc
// Good: a rule that fails the build, with a message that names the fix.
"app/globals-in-assembly": "error"
// Poor: a line in a wiki page that says "please don't use localStorage in components".
```

### One writer per durable value

```tsx
// Good: the owner holds the list; the repository only hydrates and saves.
const [todos, setTodos] = useState(() => repository.load())
const commit = (next: Todos) => { setTodos(next); repository.save(next) }

// Poor: two copies that drift. Which one is the truth after a failed save?
const [todos, setTodos] = useState([]); const cache = useTodoCache()
```

### Dependencies point down

```ts
// Good: effect code imports pure code.
import { addTodo } from './todo_reducers.pure.lib.ts'      // in todos.effect.ui.tsx

// Poor: pure code imports effect code, so it's no longer pure (app/layer-imports).
import { bindTodoRepository } from './todo_repository.effect.lib.ts'   // in a *.pure.* file
```

### Modular by feature

```
Good: src/examples/todo/{todo_state.pure.lib.ts, todos.effect.ui.tsx, todo.assembly.main.ts, …}
Poor: src/components/Todos.tsx + src/hooks/useTodos.ts + src/utils/todos.ts + src/types/todo.ts
```

### Purity where it counts

```ts
// Good: snapshot in, snapshot out; the id is passed in.
export function addTodo(todos: Todos, todo: { id: TodoId; title: string }): Todos

// Poor: hidden clock and randomness; untestable without mocking globals.
export function addTodo(todos) { todos.push({ id: Math.random(), at: Date.now() }) }
```

### Trust nothing from outside

```ts
// Good: unknown until parsed; corrupt storage hydrates as [].
const parsed = storedTodosSchema.safeParse(raw); return parsed.success ? parsed.data : []

// Poor (app/no-unchecked-cast): a cast is a promise nobody checks.
return JSON.parse(text) as Todo[]
```

### Exceptions are architecture changes

```
Good: "This needs window.matchMedia, so I moved the read into assembly and injected `prefersReducedMotion()`."
      or a reviewed PR that changes oxlint.config.ts and explains why.
Poor: // oxlint-disable-next-line app/globals-in-assembly        # noqa: TID251
```

Never `// oxlint-disable`, `@ts-ignore`, `# noqa`, or `# type: ignore` to land a change.
Move the code, or change the rule openly in review.

### Consistency beats cleverness

```
Good: a new feature that is examples/todo/ with the nouns changed.
Poor: a new feature that invents its own DI container "because it's neater".
```

### Testable in isolation

```tsx
// Good: real component, fake capabilities, observable assertions.
const Todos = bindTodos({ repository: memoryRepository([]), createId: sequentialIds(), backup: null })

// Poor: vi.mock('./todo_repository.effect.lib.ts') and asserting that save() was called.
```

### Prove it by running it

```
Good: make dev → http://localhost:5173/?screen=todo-example&flags=examples_todo_backup → add, back up, watch it work.
      Plus a story with a play function that does the same in CI.
Poor: "tsc passes, ship it."
```

## Where concepts live

Each idea is written down once. Everything else links to it.

| concept | lives in |
|---|---|
| why (philosophy, principles) | this README |
| what to run, hard rules, testing table | [AGENTS.md](AGENTS.md) |
| who may import whom, bind, globals, flags, state, API, cycles, why not context | [DEPENDENCIES.md](DEPENDENCIES.md) |
| filename grammar, reserved tokens, directory map | [FILE_NAMING_CONVENTION.md](FILE_NAMING_CONVENTION.md) |
| the matrices as code | `frontend/scripts/lint/kinds.ts` (`docs_sync.test.ts` keeps the docs in sync) |
| lint plugin maintenance | [frontend/scripts/lint/AGENTS.md](frontend/scripts/lint/AGENTS.md) |
| backend layers, naming, factories | [backend/AGENTS.md](backend/AGENTS.md) |
| composition roots | [frontend/src/main/AGENTS.md](frontend/src/main/AGENTS.md), [backend/app/composition/AGENTS.md](backend/app/composition/AGENTS.md) |
| FE↔BE contract | [frontend/src/api/AGENTS.md](frontend/src/api/AGENTS.md) |
| what the AI reviewer checks (only what lint can't) | [review-conventions.md](review-conventions.md) |
| moving legacy code over | [MIGRATION.md](MIGRATION.md), [backend/MIGRATION.md](backend/MIGRATION.md) |
| the worked example | `frontend/src/examples/todo/`, `backend/app/todo/` |

## Measure it

To tell whether the guardrails pay for themselves, track these before and after: average
CI time, revert rate, time from ready-for-review to merged, and bugs filed.

## About the app

`make e2e` runs the browser happy-path suite in `frontend/e2e/` (profiles, passwords, saved
pictures, admin) against a throwaway backend and database, so it never touches real data or
calls OpenAI. It's meant to be run every so often, not on every change, and isn't part of
CI. It drives your installed Google Chrome and saves screenshots of key screens to
`frontend/e2e-screens/`; the `e2e-happy-path` Claude Code skill runs it and reviews those
screenshots.

`make gen-types` (legacy) regenerates `frontend/src/types/generated.ts` from the Python
models. It isn't run automatically. New code uses the OpenAPI-generated types from
`make gen-api` instead, which CI checks for drift.

### Architecture

`docs/architecture/` holds the architecture diagrams: a system view plus the
backend and frontend code layers. Open `learning-game-architecture.html` in a
browser to see them rendered, or edit the Mermaid sources (`1-system.mmd`,
`2-backend.mmd`, `3-frontend.mmd`) and rebuild the page with
`python3 docs/architecture/build.py`.

### What's here

- **`backend/app/models/`** — SQLModel/Pydantic definitions for every core
  entity in PRD §4: `Profile`, `Skill`, `SkillState`, `GameMetadata`, `Level`,
  `Variant`, `Item`, `TelemetryCore`/`AttemptCreate`/`Attempt`/`AttemptRead`,
  `Event`, `PlaySession`, `Verification`, `Rating`.
- **`backend/app/games/`** — the game-module contract (`GameModule` in
  `base.py`), a registry, and one stub module (`SyllableBuilderGame`) with a
  fixed word bank and deterministic, monotonically-harder generation.
- **`backend/app/engine/level_selector.py`** — a trivial stand-in for Loop A:
  reads the stored per-(profile, game) level, defaulting to 1. The real
  promote/hold/support engine (PRD §5.1) is a later milestone; this only
  guarantees difficulty selection lives server-side.
- **`backend/app/events/log.py`** — the only way an `Event` row gets written
  (append-only, PRD §5.3).
- **`backend/app/main.py`** — the two endpoints:
  - `GET /api/items/next?profile_id=&game_id=` — server picks the level,
    generates an `Item`, logs `item_shown`.
  - `POST /api/attempts` — validates the telemetry core (rejects payloads
    missing it), persists the `Attempt`, logs `attempt`.
- **`backend/scripts/generate_ts_types.py`** — walks the Pydantic/SQLModel
  models and emits `frontend/src/types/generated.ts`, so the two sides can't
  drift (PRD §9).
- **`backend/tests/`** — pytest: generation determinism, monotonic difficulty,
  telemetry-core rejection, exactly-one-event-per-attempt.
- **`frontend/`** — Vite + React + TS placeholder shell. Fetches an item,
  renders it as raw JSON, and can POST a hardcoded valid attempt. No styling,
  no real game rendering (that's a Claude Design + later-milestone concern).

### Explicitly not built here

The real adaptive engine (promote/hold/support), the model-provider/LLM layer,
writing games and rubric scoring, ratings sampling, variant assignment logic,
the reward loop, the parent dashboard, audio, and all visual design. Fields and
interfaces exist for these (e.g. `GameModule.score_attempt`, `Variant`,
`Rating`) but carry no behavior yet — see PRD §16 for the intended order.
