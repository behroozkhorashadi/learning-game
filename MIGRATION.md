# Migration: legacy → guardrailed

Agents: read this file and follow the steps for the component you were asked to migrate.
Backend steps are in [backend/MIGRATION.md](backend/MIGRATION.md).

## Where things stand

- The tooling, docs, and worked example (`frontend/src/examples/todo/`, `backend/app/todo/`)
  have landed. Every rule is on for **new and migrated paths**.
- 113 legacy frontend files (112 in `src/` plus `e2e/zombie-hit-lab.spec.ts`) are on
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
| [x] | `games/ProfilePicker.tsx` → `profiles/` | coupled: calls `fetch('/api/profiles')` in an effect, owns loading/error state | ~13 min (agent), about half of it e2e baseline verification. New seams it needed: `api/profiles_api.effect.lib.ts` + `profiles_schema.pure.lib.ts` (zod, tied to the OpenAPI type), `api/http.pure.lib.ts` (shared `HttpFetch`), and `query/` (`useQuery` + `QueryState`, the server-state seam). Split into a props-only view (all states renderable) + `bindProfilePicker({ listProfiles })` + `assembleProfilePicker()`. Shared exports moved out: `ProfileAvatar` → `profiles/profile_avatar.pure.ui.tsx`, `AVATAR_OPTIONS` → `profiles/avatar_options.pure.lib.ts`, `PENCIL_ICON` → `den/icon_paths.pure.lib.ts`. The 8 legacy tests (which mocked `global.fetch`) are ported; 34 tests + 8 stories now. e2e: no change vs. baseline (see Known debt). |

Record the time each took, plus anything the steps above missed, then update this file.

Lessons from ProgressBar:
- **Leaf dependencies set the real scope.** The component itself was trivial; the work was its legacy imports. Check `grep "^import"` first, and migrate shared leaves (design-system pieces like `den/`) whole, since many later migrations need them.
- **Shared leaves are cheap to move:** legacy may import new-style code, so repointing importers is a mechanical path rewrite with no behavior change.
- **Found while writing tests:** the progress dots carry `aria-label` on a plain `div`, which screen readers may ignore. Not changed in a move-only migration; candidate follow-up: `role="progressbar"` with `aria-valuenow`/`aria-valuemax`.

Lessons from ProfilePicker:
- **The first coupled component pays for the seams** (API adapter, `HttpFetch`, `useQuery`). The next screen that fetches reuses all three, so it should take a fraction of the time.
- **Split view from binding.** A props-only view taking a `QueryState` makes loading, failed, and empty renderable in stories and tests without a fake network. The legacy component could only be tested by mocking `global.fetch`.
- **Parse stricter than the schema where the UI depends on it** (`id` required). A malformed row is now a visible error instead of a silently unclickable tile.
- **Run the e2e suite against a baseline,** not just after. Stash the migration and run it on the previous commit, or you can't tell your failures from existing ones.
- **Legacy callers assemble once** with `useState(assembleX)` (`App.tsx`, `DevScreenPicker.tsx`), until the shell itself migrates to `src/main/`.

## Migration log (after the pilot)

| component | effort | notes |
|---|---|---|
| `games/CreateProfile.tsx` + `ProfileFormFields`, `ProfilePasswordFields`, `ProfilePhotoCapture`, `newPhotosPayload` → `profiles/` | ~15 min (agent) | Reused `HttpFetch` and the profiles adapter as predicted (it gained `create` and `remixPhoto`; `failureMessage` in `api/http.pure.lib.ts` keeps the server's user-facing `detail`). New seams: a `ProfileCamera` capability (`profile_camera.effect.lib.ts` over `navigator.mediaDevices` + a canvas factory) driven by `use_camera.pure.hook.ts`, and an injected `today()` clock replacing module-level `new Date()`. The photo panel is injected into the create screen as a bound component (`PhotoCapture` bind arg); legacy `EditProfile` assembles it with `useState(assembleProfilePhotoCapture)`. Fixed in passing: a camera stream that opened after unmount was never stopped. 7 legacy files out; 21 tests in the ported suites (no `global.fetch`/`navigator` stubs) plus 60 new; 12 stories. |
| `games/ProfileUnlock.tsx`, `games/EditProfile.tsx`, `games/AdminPanel.tsx`, `components/AdminLoginForm.tsx` → `profiles/`, `admin/` | ~25 min (agent) | Profiles adapter gains `update`/`remove`/`unlock`/`listPhotos`/`deletePhoto`; `api/admin_api` for login. Auth headers became a typed `ProfileAuth` (`none`/`profile`/`admin`) that only the adapter turns into headers. New seams: `query/use_reloadable_query` (re-read after a mutation without blanking the list) and `profiles/use_saved_photos` (the one owner of the saved-photo list). Screens are keyed by profile id (`key={profile.id}`), since each mount is one editing session. Admin rows gained per-player accessible names (`Edit Rami`, `Delete Rami`). 7 legacy files out. |
| `components/den/*` → `den/`, session shell (`SessionStart`, `SessionComplete`, `RatingPrompt`, `ParentVerify`, `HandoffPencil`) → `session/` | ~20 min (agent) | Props-only moves. Speaking became a callback prop (`onHearInstructions`, `onHearWord`); legacy callers still pass `lib/speech`, which migrates with its last caller. ParentVerify's 500 ms `setTimeout` became the shake animation's `onAnimationEnd`, so no timer is left to inject. `DenJar` gained `role="progressbar"`, and the PIN dots a live accessible label. `DenTabs` had no importers and was deleted. 14 legacy files out. |
| `lib/speech.ts` → `speech/`, `lib/id.ts` → `ids/` | ~8 min (agent) | Migrated ahead of their callers because both the zombie arena and the word games use them. `Speech` is a capability (`bindSpeech({ synthesis, makeUtterance, playClip })`); the UUID maths is pure (`uuidV4FromBytes`), and `crypto` is read only in `assembleRandomId()`. Legacy callers assemble once at module scope (`const randomId = assembleRandomId()`) until they migrate and take these injected. 2 legacy files out. |
| `components/BadgesAccomplishments.tsx` → `badges/` | ~10 min (agent) | `api/badges_api` (badges + stats, zod). Split into a props-only `BadgesView` over a `QueryState` and `bindBadges({ loadBadges, loadStats, now })`; the date formatting became pure with an injected `now`. 2 legacy files out. |
| `games/SyllableBuilder.tsx`, `games/EquationBuilder.tsx`, `components/TileAssembly.tsx` → `syllable_builder/`, `equation_builder/`, `practice/`, `tiles/` | ~40 min (agent) | The two games shared a copy-pasted session loop; it's now one seam: `practice/use_practice_session` over `PracticeDeps` (`loadItem`, `recordAttempt`, `rate`, `verify`, `createId`, `now`, `wait`), driving a pure `practice_session` reducer. Each game keeps only its zod payload parser, its board mapping, and its view (no more `payload as unknown as`). `TileAssembly` became `tiles/TileBoard` ("assembly" is a reserved filename token) over a pure placement reducer. It drags with pointer capture and slot refs instead of window listeners and `elementFromPoint`, and no longer hides a tray tile mid-drag (it used to vanish under the pointer). The item-change reset effect is gone because callers key it by item. `setTimeout(900)` is an injected `wait`. 6 legacy files out. |
Lessons:
- **Look for the copy-paste before the component.** Two "different" games were one session loop with different payloads. Migrate the shared loop once (`practice/`) and each game shrinks to a parser and a view.
- **Inject a child component when a screen embeds a stateful panel** (`PhotoCapture: ComponentType<…>`). `bind*` can't be called outside assembly, so the parent's assembly binds the child and passes it in.
- **Module-level `new Date()` is a hidden global.** `Date.now` is linted; `new Date()` isn't yet. Pass `today` in.
- **Labels that grow hints break `getByLabelText`.** Hold on to the input element across edits.

## Known debt surfaced by the new rules (fix during migration)

- **e2e and the local Chrome (resolved):** the installed Google Chrome 155 on this machine exits about 5.7s after launch, even on `about:blank`, so long runs failed with "Target page, context or browser has been closed". e2e and the Storybook tests now use Playwright's bundled Chromium, as CI does.

- **`e2e/zombie-hit-lab.spec.ts` is timing-flaky:** it waits a fixed 3 s for the zombie GLB to load before clicking (`waitForTimeout`), and failed once in ~6 runs. Replace with waiting on a ready signal when the zombie cluster migrates.

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
| frontend `src/` + e2e | 113 (`legacy_allowlist.json`) |
| backend | 67 (`backend/scripts/lint_py/legacy_allowlist.txt`) |

Update this table in the PR that lowers a ceiling.
