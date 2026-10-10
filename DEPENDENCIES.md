# Dependencies: who may import whom

This page is the contract the lint rules enforce. The tables below are checked against
`frontend/scripts/lint/kinds.ts` by a test (`docs_sync.test.ts`), so they can't drift.
Backend equivalents are in [`backend/AGENTS.md#layers`](backend/AGENTS.md#layers).

Every frontend file under `src/` is `<basename>.<color>.<kind>.ts(x)` (see
[FILE_NAMING_CONVENTION.md](FILE_NAMING_CONVENTION.md)). An import is legal only if it
passes **both** matrices, classified by the **target's filename**. `import type` gets
no exemption.

## Color matrix

Color is the layer, and it is the dependency-injection bit. Higher may import the same
or lower, never up.

| color | what it does |
|---|---|
| `test` | construct, stimulate, assert. Tests and stories are always `test` |
| `assembly` | performs DI: reads globals/env/flags, picks implementations, calls `bind*` |
| `effect` | needs DI: declares a `bind*` factory, or receives an injected handle |
| `pure` | no DI: plain imports plus args/props. Same input, same output |

<!-- color-matrix:start -->
| from \ may import | test | assembly | effect | pure |
|---|:-:|:-:|:-:|:-:|
| test | ✅ | ✅ | ✅ | ✅ |
| assembly | ❌ | ✅ | ✅ | ✅ |
| effect | ❌ | ❌ | ✅ | ✅ |
| pure | ❌ | ❌ | ❌ | ✅ |
<!-- color-matrix:end -->

Rule: `app/layer-imports`. Nothing in production imports `test`.

## Kind matrix

Kind is what the file *is*. Tests and stories count as `main`.

| kind | holds |
|---|---|
| `main` | composition roots and entries |
| `ui` | components. May import React. Never declares `use*` hooks, never calls `useEffect` |
| `hook` | React hooks. The only place `useEffect` lives. Never declares components |
| `lib` | logic, types, services, reducers, schemas. **No React, not even `import type`** |

<!-- kind-matrix:start -->
| from \ may import | main | ui | hook | lib |
|---|:-:|:-:|:-:|:-:|
| main | ✅ | ✅ | ✅ | ✅ |
| ui | ❌ | ✅ | ✅ | ✅ |
| hook | ❌ | ❌ | ✅ | ✅ |
| lib | ❌ | ❌ | ❌ | ✅ |
<!-- kind-matrix:end -->

Rules: `app/layer-imports`, `app/kind-discipline`, `app/hook-filename`, `no-restricted-imports`
(React banned in `*.lib`).

## Features

- `src/<feature>/` is the unit of work: logic, UI, hooks, tests, and stories together,
  owned and deletable as one unit. Nested folders (`examples/todo/`) are groupings inside
  the parent feature.
- No kind-named directories (`components/`, `hooks/`, `utils/`, `types/`). Kind lives in
  the filename.
- No `index.ts` barrels: import the concrete file (`app/no-barrel-index`,
  `app/alias-targets-concrete-file`).
- Same feature: **relative** imports (`app/relative-within-feature`). Another feature:
  the **`@app/` alias to the concrete file**, e.g. `@app/api/todos_api.effect.lib.ts`
  (`app/require-alias-across-features`, which autofixes and names the exact path).
- New-style code never imports legacy (unsuffixed) files. Migrate the dependency first
  ([MIGRATION.md](MIGRATION.md)). Legacy may import new-style code.
- Composition roots: `src/main/` (the legacy shell `src/main.tsx` + `App.tsx` until it
  migrates). See [`frontend/src/main/AGENTS.md`](frontend/src/main/AGENTS.md).

## Bind

A feature is a `bindX({ ...deps })` factory that closes over injected services and returns
a component, adapter, or hook.

| rule | enforced by |
|---|---|
| `bind*` is declared only in `*.effect.*` files | `app/factory-discipline` |
| `bind*` is invoked only in `*.assembly.*` (inside `assembleX()`), in tests/stories, or inside another `bind*` body | `app/factory-discipline` |
| no `bind*()` at module scope (that's a global singleton) | `app/bind-invoked-in-function` |
| no optional or defaulted `bind*` args (`now = Date.now` hides a dependency) | `app/bind-required-args` |
| assembly declares no components and has no JSX | `app/no-components-in-assembly` |

- **Props vs bind args.** Per-instance data (ids, titles, callbacks that vary per render)
  are props. Construction-time capabilities (repository, clock, id factory, API client)
  are bind args.
- **Narrowest capability.** Inject `{ getItem, setItem }`, not `Storage`; `() => { id } | null`,
  not the user model; `{ replaceAll }`, not the API client. Read-only consumers get no
  write access.
- **Values plus narrow commands.** UI receives `availableBalance` and `onTransfer`, never
  `setBalance`. The contract type declares every command, so a missing binding is a
  compile error.

## Globals

`window`, `document`, `globalThis`, `self`, `localStorage`, `sessionStorage`, `navigator`,
`location`, `history`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `setTimeout`,
`setInterval`, `requestAnimationFrame`, `requestIdleCallback`, `crypto`, `matchMedia`,
`indexedDB`, `Worker`, `performance`, plus `Date.now`, `new Date()` and `Math.random` as
nondeterminism, may be **named only in `*.assembly.*`** (`app/globals-in-assembly`).
Assembly reads them and injects a narrow handle. Property names (`x.window`) and type
positions (`typeof window`) don't count.

## Flags

Feature flags (`@app/flags/feature_flags.effect.lib.ts`, `?flags=a,b`) are read **only in
assembly**. The result (a boolean, or a getter) is injected. Tests and stories never read
flags; they pass each mode in (`backup: null` vs. a real backup). Type-only imports are
fine; re-exports are not (`app/flags-in-assembly`).

## State

- Client state is plain React (`useState`, `useReducer`, `useSyncExternalStore`). Redux,
  RTK, zustand, jotai, recoil, mobx, valtio, xstate, effector and immer are banned
  (`no-restricted-imports`).
- Reducers are pure functions in `*.pure.lib.ts`: snapshot in, snapshot out, explicit
  immutable spreads. The feature that owns a list holds it in `useState`, applies reducers
  in event handlers, and persists through an injected repository. The repository hydrates
  and saves; it is **not** the live source of truth.
- **One writer per durable value.** No second cached copy. Don't mirror server state into
  client state.
- **Async operations are a separate layer** (`*.effect.lib.ts`). Reducers stay synchronous
  (`saving()`, `saved(n)`, `failed(msg)`). The operation receives a narrow capability plus
  bound commands, drives `idle → saving → saved | failed`, and owns retries, cancellation,
  concurrency and stale-result policy. Results land on the instance that started them.
  See `examples/todo/todo_backup.effect.lib.ts`.
- Action payloads are serializable: no functions, promises, or methods
  (`app/serializable-actions`).
- Selectors return stable references, never a freshly allocated object or array
  (`app/no-unstable-selector`).
- UI reaches shared state only through a domain hook, never raw store bindings
  (`app/no-store-access-in-components`).
- A `<Suspense>` needs an error boundary ancestor in the same file; use `<AsyncBoundary>`
  from `@app/boundary/async_boundary.pure.ui.tsx` (`app/require-error-boundary-for-suspense`).

## API

- Everything from outside (HTTP, storage, URL params, `postMessage`, env) is `unknown`
  until **parsed with zod** in the effect adapter that owns it. Never `JSON.parse(x) as T`
  or `(await res.json()) as T` (`app/no-unchecked-cast`).
- HTTP lives in `src/api/*.effect.lib.ts` adapters over an injected `fetch`. Components
  never touch the network (`app/no-network-in-components`).
- **The backend is the source of truth for the wire format.** `make gen-api` exports the
  FastAPI OpenAPI schema and regenerates `src/api/openapi_schema.pure.lib.ts`. CI fails if
  the committed copy differs. Adapters tie their zod schema to the generated type with
  `satisfies`, so a backend change is a frontend compile error. Generated types are a
  claim, not proof, so the adapter still parses. See
  [`frontend/src/api/AGENTS.md`](frontend/src/api/AGENTS.md).

## Cycles

Value (runtime) import cycles are forbidden; type-only cycles are allowed. Checked over the
whole graph by `npm run check:cycles` (`frontend/scripts/check_cycles.ts`, Tarjan SCC over
value edges) and `backend/scripts/check_cycles.py`. Break a cycle by moving the shared
piece down a layer, or by injecting it from assembly.

## Why not context

Why explicit `bind*` construction instead of React Context/Provider DI or shared writable
atoms:

- **Providers hide dependencies from the public interface.** A component looks
  self-contained but needs services from somewhere up the tree. New dependencies appear
  without any interface change. Which implementation you get depends on where the
  component renders, so moving UI can silently swap infrastructure. Type checking verifies
  the value's shape, not the provider's placement. You can't derive test setup from the
  props, and a test mock can be shadowed by an inner provider.
- **Shared writable atoms** (Jotai-style) do the same and also grant excess authority:
  importing an atom to read it hands you its setter. Invariants become conventions
  (`setBalance(80)` instead of `withdraw(20)`).
- **With explicit construction**, adding a required service to `bindX` makes every assembly
  point that omits it fail to compile. Tests see the exact inputs and pass fakes.

Rule: context is allowed only for intentionally tree-scoped **presentation** values (theme,
locale), in files listed in `app/no-service-context`'s `allow` option. Never for
infrastructure (API clients, repositories, analytics, stores). FastAPI `Depends(...)` is the
backend version of a Provider; see [`backend/AGENTS.md#assembly`](backend/AGENTS.md#assembly).
