# Migration: legacy → guardrailed

Agents: read this file and follow the steps for the component you were asked to migrate.
Backend steps are in [backend/MIGRATION.md](backend/MIGRATION.md).

## Where things stand

- The tooling, docs, and worked example (`frontend/src/examples/todo/`, `backend/app/todo/`)
  have landed. Every rule is on for **new and migrated paths**.
- 153 legacy frontend files (152 in `src/` plus `e2e/zombie-hit-lab.spec.ts`) are on
  `frontend/scripts/lint/legacy_allowlist.json`. They're typechecked by
  `tsconfig.legacy.json` at their old strictness, and the architecture, type-aware, and
  strict-style rules skip them. The security, barrel, context, and scenario-test rules
  already apply to them.
- The list **only shrinks**. `legacy_allowlist.test.ts` fails if it grows, holds a path
  that no longer exists, holds an already-migrated file, or misses an unsuffixed file.
  When you migrate a file, delete its entry and lower `LEGACY_CEILING`.
- Backend: 67 legacy files, same ratchet (`backend/scripts/lint_py/legacy_allowlist.txt`).

## The unit of migration: "renders in isolation"

"Clean up the architecture" has no finish line. This does:

> **The component renders in Storybook and in tests in isolation, with fixtures and
> interaction tests, through a `bindX({ ... })` with fake capabilities.**

Getting there forces exactly the refactor that matters: inject its dependencies
explicitly, split UI from logic, and remove ambient state (`fetch`, `localStorage`,
`window`). Refactor only what that requires. Don't rename what you don't touch.

Migrate when someone is already changing the component. The migrated version comes with
fast unit tests and a story, so the change itself gets faster. That DX is the incentive.

## Steps (one component)

1. **Pick the component and its closest dependencies.** New-style code can't import legacy,
   so list the legacy files it needs (`grep` its imports). Either migrate them too, or have
   assembly adapt them and inject a narrow function.
2. **Create the feature folder:** `src/<feature>/`, named for the domain (`profiles/`,
   `pathfinder/`), never for a kind.
3. **Split it up the way `examples/todo/` is:**
   - types and capability interfaces → `<x>_state.pure.lib.ts`
   - pure logic → `<x>_<what>.pure.lib.ts`
   - each `fetch` → an adapter in `src/api/<x>_api.effect.lib.ts` (zod-parsed; add the
     endpoint to the generated schema with `make gen-api` if it's missing)
   - each `localStorage`/`window`/timer use → an injected narrow handle
   - each `useEffect` → `use_<x>.<color>.hook.ts`
   - the component → `<x>.pure.ui.tsx` (props only) and/or `<x>s.effect.ui.tsx` (`bindX`)
   - wiring → `<x>.assembly.main.ts` (`assembleX()`)
4. **Point the legacy caller at it.** The caller calls `assembleX()` once (e.g.
   `useState(() => assembleX())`, as `src/dev/DevScreenPicker.tsx` does), or move the
   caller to `src/main/` if you're migrating it too.
5. **Tests and a story:** colocated `.test.tsx` per file, `.stories.tsx` per UI file with a
   `play` function. Port **behavior**, not just JSX: focus, IME, scroll, disabled states,
   error states. Keep the old test passing until the new one covers the same behavior,
   then delete the old one.
6. **Ratchet:** delete the old files, remove their entries from
   `legacy_allowlist.json`, lower `LEGACY_CEILING` in `legacy_allowlist.test.ts`, run
   `make preflight`.

## Pilot (do these first, measure the effort, then estimate the rest)

| | component | why | effort |
|---|---|---|---|
| [x] | `components/ProgressBar.tsx` → `session/progress_bar.pure.ui.tsx` | simple: props only, no state | ~3 min (agent). Its two legacy deps had to migrate with it: `DenButton` → `den/den_button.pure.ui.tsx`, `icons` → `den/icons.pure.ui.tsx`. 3 files moved (`git mv`, history kept), 36 legacy importers repointed to `@app/…`, then explicit return types and `readonly` props (strict tsc already passed). 21 tests and 10 stories added. |
| [ ] | `games/ProfilePicker.tsx` | coupled: calls `fetch('/api/profiles')` in an effect, owns loading/error state | _record actual time here_ |

Record the time each took, plus anything the steps above missed, then update this file.

Lessons from ProgressBar:
- **Leaf dependencies set the real scope.** The component itself was trivial; the work was its legacy imports. Check `grep "^import"` first, and migrate shared leaves (design-system pieces like `den/`) whole, since many later migrations need them.
- **Shared leaves are cheap to move:** legacy may import new-style code, so repointing importers is a mechanical path rewrite with no behavior change.
- **Found while writing tests:** the progress dots carry `aria-label` on a plain `div`, which screen readers may ignore. Not changed in a move-only migration; candidate follow-up: `role="progressbar"` with `aria-valuenow`/`aria-valuemax`.

## Known debt surfaced by the new rules (fix during migration)

- **`<Suspense>` without an error boundary** in 7 react-three-fiber spots:
  `components/EquationBlaster.tsx` (×3), `games/framework/ZombieArena.tsx`,
  `dev/ZombiePOCScene.tsx`, `dev/WeaponPOCScene.tsx`, `dev/ZombieHitLab.tsx`. The boundary
  has to live inside `<Canvas>` (it's a different reconciler), so this is a real change,
  not a find-and-replace. The rule is on for new-style code only until these migrate.
- **React-compiler correctness** (`react/refs`, `react/purity`, `react/set-state-in-effect`)
  in `EquationOutbreakScene`, `EquationBlaster`, `MuzzleFlash`, `TileAssembly`,
  `ModifierDeck`, `Pathfinder`, and `lib/usePathfinderPlay`. Off for legacy, on for new code.
- **Legacy unit tests mock `global.fetch` directly.** Migrated tests inject a fake `fetch`
  through the adapter's bind args instead.
- **`src/types/generated.ts`** (from `make gen-types`, the legacy model-walker) overlaps
  with the OpenAPI-generated `src/api/openapi_schema.pure.lib.ts`. Retire `gen-types` once
  nothing legacy imports `types/generated.ts`.

## Progress

| area | legacy files left |
|---|---|
| frontend `src/` + e2e | 153 (`legacy_allowlist.json`) |
| backend | 67 (`backend/scripts/lint_py/legacy_allowlist.txt`) |

Update this table in the PR that lowers a ceiling.
