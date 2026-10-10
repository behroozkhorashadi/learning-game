# Agent guide

Read this first. The *why* is in [README.md](README.md). The import rules are in
[DEPENDENCIES.md](DEPENDENCIES.md), filenames in
[FILE_NAMING_CONVENTION.md](FILE_NAMING_CONVENTION.md), and the backend in
[backend/AGENTS.md](backend/AGENTS.md). Folders with their own contract have their own
`AGENTS.md`; read it before editing there.

## Preflight

```
make preflight          # everything CI runs; must pass before you push
make dev                # start backend (:8000) + frontend (Vite) together, to see your change run
```

Narrower loops while iterating (from `frontend/`):

```
npm run typecheck       # tsc -b: app (strict) + legacy + tooling projects
npm run lint            # oxlint --type-aware --deny-warnings + local plugin (scripts/lint/)
npm run check:cycles    # value import cycles over src/
npm run test:lint-rules # the lint plugin's own tests
npm test                # unit tests (jsdom)
npm run test:storybook  # every story, as a browser test (Chrome)
npm run check:api       # FE types match the backend's OpenAPI (make gen-api to regenerate)
```

Backend: `backend/scripts/preflight.sh` (ruff, pyright strict, import-linter, AST rules,
cycles, pytest).

A failing check is telling you where the code goes. Every lint message names the fix and
links the doc. **Never silence a rule** (`oxlint-disable`, `@ts-ignore`, `# noqa`,
`# type: ignore`) to land a change: move the code, or propose the rule change openly in
review.

## Non-negotiable principles

Each of these fails the build. The rule that enforces it is in parentheses.

1. **Code lives in feature folders, kind lives in the filename.** `src/<feature>/<basename>.<color>.<kind>.ts(x)`. No `components/`, `utils/`, or `index.ts` (`app/layer-imports`, `app/no-barrel-index`, `app/reserved-filename-tokens`).
2. **Dependencies point down.** test → assembly → effect → pure; main → ui → hook → lib. `import type` included (`app/layer-imports`).
3. **Dependencies are injected, never reached for.** Features are `bindX({ ...deps })` in `*.effect.*`, invoked only from `assembleX()` in `*.assembly.*` (`app/factory-discipline`, `app/bind-invoked-in-function`). Every dep is required (`app/bind-required-args`).
4. **Only assembly touches the world.** `window`, `localStorage`, `fetch`, `setTimeout`, `crypto`, `Date.now`, `Math.random`, and feature flags are named only in `*.assembly.*` (`app/globals-in-assembly`, `app/flags-in-assembly`).
5. **No services through context.** Context is for theme/locale only (`app/no-service-context`).
6. **Components render; hooks do effects; libs don't know React.** (`app/no-effects-in-components`, `app/kind-discipline`, `no-restricted-imports` for React in `*.lib`.)
7. **No network in components.** HTTP goes through a `src/api/` adapter injected via `bind*` (`app/no-network-in-components`).
8. **Plain React state, one writer per value.** No state libraries (`no-restricted-imports`). Pure reducers, serializable actions, stable selectors (`app/serializable-actions`, `app/no-unstable-selector`, `app/no-store-access-in-components`).
9. **Parse at the door.** External data is `unknown` until zod parses it. No unchecked `as` (`app/no-unchecked-cast`, `typescript/no-unsafe-*`).
10. **Suspense is always caught.** Use `<AsyncBoundary>` (`app/require-error-boundary-for-suspense`).
11. **No value import cycles** (`npm run check:cycles`).
12. **The API contract is generated.** Backend changes regenerate `src/api/openapi_schema.pure.lib.ts`; CI fails on drift (`npm run check:api`).
13. **Every change ships with tests**, and every new UI file with a story.

## Adding a feature (copy the example)

The worked example is [`frontend/src/examples/todo/`](frontend/src/examples/todo/) (backend:
[`backend/app/todo/`](backend/app/todo/)). Copy its shape:

1. **Contract:** `<x>_state.pure.lib.ts`, with data types, branded ids, and the capability interfaces the feature needs (`TodoRepository`, `TodoBackupRemote`).
2. **Logic:** `<x>_reducers.pure.lib.ts`, pure snapshot-in/snapshot-out functions.
3. **Adapters:** `<x>_repository.effect.lib.ts`, with `bindXRepository({ storage })` over an injected narrow handle, zod-parsing what it reads.
4. **Async operations** (if any): `<x>_<op>.effect.lib.ts`, which drives sync status reducers through bound commands and owns the stale-result policy.
5. **Props-only UI:** `<x>.pure.ui.tsx`. Every control has an accessible name.
6. **Feature component:** `<x>s.effect.ui.tsx`, where `bindXs({ repository, createId, ... })` returns a component that owns its state in `useState`.
7. **Assembly:** `<x>.assembly.main.ts`, where `assembleXs()` reads globals and flags, picks implementations, and calls `bind*`. Register it in a composition root (`src/main/`).
8. **Tests and stories:** one colocated `.test.ts(x)` per file, one `.stories.tsx` per UI file (see Testing).
9. **Backend endpoint?** Add it in `backend/app/<feature>/`, then run `make gen-api` and write the zod adapter in `src/api/`.

Touching legacy code (anything on `frontend/scripts/lint/legacy_allowlist.json` or
`backend/scripts/lint_py/legacy_allowlist.txt`)? Small fixes are fine in place. A new
feature or a real rework means migrating the touched component first:
[MIGRATION.md](MIGRATION.md).

## Testing

| seam | how | example |
|---|---|---|
| reducer | call the pure function, assert the snapshot | `todo_reducers.pure.lib.test.ts` |
| adapter | bind it over a fake handle (a `Map` for storage, a fake `fetch`) | `todo_repository.effect.lib.test.ts`, `todos_api.effect.lib.test.ts` |
| async operation | a remote whose promises settle when the test says; assert each state, the stale-result policy, and that results land on the right instance | `todo_backup.effect.lib.test.ts` |
| pure UI | render with props and `vi.fn()`, query by role and name | `todo.pure.ui.test.tsx` |
| feature | `bindX` with in-memory fakes, drive it like a user, assert what is visible and what was saved | `todos.effect.ui.test.tsx` |
| composition | one real-graph test of `assembleX()`; replace only the network edge | `todo.assembly.main.test.tsx` |
| story | the real bound component with fake capabilities and seeded state, plus a `play` function; runs in Chrome in CI | `todos.effect.ui.stories.tsx` |
| backend | services with fakes (fixed clock, sequential ids, in-memory repo); one integration test boots `assemble_app` on SQLite | `backend/tests/todo/` |
| e2e smoke | a few stable tests proving FE ↔ BE connect, against a throwaway backend (`make e2e`, on demand) | `frontend/e2e/todo-example.spec.ts` |

- Query by **role and accessible name** (`getByRole('button', { name: 'Add' })`), never by class or test id. Every interactive element needs an accessible name.
- Await observable changes (`findByText`), never fixed sleeps. No real network, no `Math.random`/`Date.now`, no `.only`, no order dependence (`app/no-unstable-scenario-test`).
- **No `vi.mock` of our own modules, no `mock.patch` of first-party code.** Pass fakes through the bind/factory seam.
- Assert observable behavior against the task's acceptance criteria, not against the implementation. A fake must not hide the transition under test: a constant hook hides updates, and an always-succeeding callback hides failures.
- Prove it by running it: `make dev`, then open `?screen=todo-example` (dev builds) to drive the example in the real app.

## TypeScript

The app and tooling projects are maximally strict (`frontend/tsconfig.strict.json`):
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnused*`, `useUnknownInCatchVariables`,
`verbatimModuleSyntax`, `noUncheckedSideEffectImports`. Never relax them.

- No `any`: use `unknown` and narrow. No `!`. No `as unknown as`. No unchecked `as`. The only casts allowed are branded-ID constructors in the same file as the brand (`toTodoId`) and test helpers with a comment above saying why.
- No `@ts-ignore` or `@ts-nocheck`. `@ts-expect-error` needs a written reason.
- Exported functions have explicit return types.
- Discriminated unions, with `assertNever` in `default` (`switch-exhaustiveness-check`).
- `readonly` everywhere: fields, arrays (`readonly T[]`), records.

Python: `pyright --strict`, ruff (with `ANN401`, no `Any`), no bare suppressions. See [backend/AGENTS.md](backend/AGENTS.md).

## Security

Output sinks are linted everywhere in `src/`, legacy included:

- No `dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`, or `insertAdjacentHTML` unless the value comes from an allowlisted sanitizer. `document.write` is never allowed (`app/no-dangerous-html`). Render text through JSX.
- No `javascript:`/`vbscript:`/`data:text/html` URLs in `href`/`src`/`action`/`formAction`/… (`app/no-unsafe-jsx-url`).
- `target="_blank"` needs `rel="noopener noreferrer"` (`app/no-target-blank-without-rel`, autofix).
- No `eval`/`new Function`/string timers (`no-eval`, `no-new-func`, `typescript/no-implied-eval`).
- Secrets live in `backend/.env` (gitignored), read once in assembly. Never in the frontend bundle.

## Performance

- Selectors and `useSyncExternalStore` snapshots return stable references (`app/no-unstable-selector`). A fresh object re-renders every consumer.
- Derive during render instead of syncing with an effect. Most `useEffect` + `setState` pairs are a bug (`react/set-state-in-effect`).
- `bind*` runs once per assembly, not per render. Keep construction out of components (`useState(() => …)` if a legacy bridge must assemble lazily).
- The 3D scenes (`react-three-fiber`) are legacy and perf-sensitive. Measure before and after when you touch them.
