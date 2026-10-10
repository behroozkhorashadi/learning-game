# File naming convention

The filename is the architecture: it says which layer a file is in and what it may import.
Lint reads it (`frontend/scripts/lint/kinds.ts`), so a wrong name fails the build. Backend
naming (`app/<feature>/<basename>_<kind>_<color>.py`) is in
[`backend/AGENTS.md#file-naming`](backend/AGENTS.md#file-naming).

## Grammar

```
src/<feature>/[<grouping>/]<basename>.<color>.<kind>.ts(x)
                           <basename>.<color>.<kind>.test.ts(x)    colocated test
                           <basename>.<color>.<kind>.stories.tsx   colocated story (UI files)

color ∈ pure | effect | assembly | test        (see DEPENDENCIES.md#color-matrix)
kind  ∈ main | ui | hook | lib                 (see DEPENDENCIES.md#kind-matrix)
```

- `basename` is snake_case.
- A file that exports a hook is `use_<name>.<color>.hook.ts` (`.ts`; hooks render nothing).
- Every production file under `src/` carries the suffix. A missing suffix is a lint error,
  except for files on the shrinking legacy allowlist
  (`frontend/scripts/lint/legacy_allowlist.json`, see [MIGRATION.md](MIGRATION.md)).
- `test`-colored non-fixture files (`fake_clock.test.lib.ts`) hold shared fakes for tests.
- Generated files follow the grammar too (`src/api/openapi_schema.pure.lib.ts`).

Regex (single source: `FILE_RE` in `kinds.ts`):
`^(.+)\.(pure|effect|assembly|test)\.(main|ui|hook|lib)(?:\.(test|stories))?\.tsx?$`

## Kinds

| kind | may contain | may not contain |
|---|---|---|
| `ui` | components, `useState`/`useReducer`/`useMemo`, calls to domain hooks | `use*` declarations, `useEffect`/`useLayoutEffect`/`useInsertionEffect`, network I/O, raw store access |
| `hook` | `use*` hooks, including effects | components, JSX |
| `lib` | logic, types, reducers, schemas, adapters, operations | React (not even `import type`) |
| `main` | composition roots (`assembleX()`), entries | (anything; nothing but `main` imports it) |

## Reserved tokens

`pure effect assembly test main ui hook lib stories bind` appear only in their slots,
never as a `_`-separated basename segment (`app/reserved-filename-tokens`).

## Wrong → right

| wrong | right | why |
|---|---|---|
| `src/components/TodoRow.tsx` | `src/examples/todo/todo.pure.ui.tsx` | feature folder, not kind folder; suffix required |
| `src/examples/todo/helpers.ts` | `todo_reducers.pure.lib.ts` | name it for what it is, with color + kind |
| `bind_store.effect.lib.ts` | `store.effect.lib.ts` | `bind` is reserved |
| `todo_ui.pure.ui.tsx` | `todo_row.pure.ui.tsx` | `ui` is reserved |
| `todos.effect.hook.ts` exporting `useTodos` | `use_todos.effect.hook.ts` | hook files are `use_*` |
| `TodoRow.pure.ui.tsx` | `todo_row.pure.ui.tsx` | snake_case basename |
| `todo_repository.pure.lib.ts` with `bindTodoRepository` | `todo_repository.effect.lib.ts` | `bind*` needs DI, so it's effect |
| `todo.assembly.main.tsx` with JSX | `todo.assembly.main.ts`, JSX in a `*.ui.tsx` | assembly only calls `bind*` |
| `src/examples/index.ts` | (delete it) | no barrels |

## Directory map

```
frontend/
  oxlint.config.ts          lint config (every rule `error`)
  tsconfig.json             solution: app (strict) + legacy (shrinking) + tooling (strict)
  scripts/lint/             local oxlint plugin: one rule per file + colocated test
  scripts/check_cycles.ts   whole-graph value-cycle check
  scripts/gen_api.sh        OpenAPI → src/api/openapi_schema.pure.lib.ts
  src/
    main/                   composition root (assembles new-style screens)
    examples/todo/          THE worked example, copy it
    api/                    HTTP adapters + generated OpenAPI types
    flags/                  feature-flag client (assembly-only)
    boundary/               <AsyncBoundary>
    den/                    design system (DenButton, icons), migrating from components/den/
    session/                session-flow UI (ProgressBar)
    profiles/               profile picker, avatars
    query/                  useQuery: the server-state seam
    components/ games/ lib/ dev/ types/ styles/   legacy (allowlisted, migrating)
backend/
  app/<feature>/            new-style features (app/todo/ is the example)
  app/composition/          backend composition root (assemble_app)
  scripts/lint_py/          custom AST rules + import-linter color contract
```
