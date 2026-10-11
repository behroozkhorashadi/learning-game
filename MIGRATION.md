# Migration: legacy → guardrailed (done)

**Every file now follows the guardrails.** 151 legacy frontend files and 67 backend files
were migrated or deleted, and the scaffolding that let the two styles coexist is gone:
the allowlists, their ratchet tests, `tsconfig.legacy.json`, the oxlint legacy override,
and the `make gen-types` model-walker. There is nothing to exempt a file any more, and an
`oxlint-disable` / `# noqa` / `@ts-ignore` comment is itself a lint error.

This file is the record: the method, the effort, and the lessons. Read it before a large
rewrite or before bringing outside code in. The backend's record is
[backend/MIGRATION.md](backend/MIGRATION.md).

## The unit of migration: "renders in isolation"

"Clean up the architecture" has no finish line. This does:

> **The component renders in Storybook and in tests in isolation, with fixtures and
> interaction tests, through a `bindX({ ... })` with fake capabilities.**

Getting there forces exactly the refactor that matters: inject its dependencies
explicitly, split UI from logic, and remove ambient state (`fetch`, `localStorage`,
`window`). Refactor only what that requires. Don't rename what you don't touch.

Migrate when someone is already changing the component. The migrated version comes with
fast unit tests and a story, so the change itself gets faster. That DX is the incentive.

## The method (one component at a time)

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
4. **Point the legacy caller at it.** While the shell was legacy, callers assembled once
   with `useState(assembleX)` or at module scope; the shell itself migrated last.
5. **Tests and a story:** colocated `.test.tsx` per file, `.stories.tsx` per UI file with a
   `play` function. Port **behavior**, not just JSX: focus, IME, scroll, disabled states,
   error states. Keep the old test passing until the new one covers the same behavior,
   then delete the old one.
6. **Ratchet:** delete the old files and lower the allowlist ceiling (both since removed),
   then `make preflight`.

## Pilot

| | component | why | effort |
|---|---|---|---|
| [x] | `components/ProgressBar.tsx` → `session/progress_bar.pure.ui.tsx` | simple: props only, no state | ~3 min (agent). Its two legacy deps had to migrate with it: `DenButton` → `den/den_button.pure.ui.tsx`, `icons` → `den/icons.pure.ui.tsx`. 3 files moved (`git mv`, history kept), 36 legacy importers repointed to `@app/…`, then explicit return types and `readonly` props (strict tsc already passed). 21 tests and 10 stories added. |
| [x] | `games/ProfilePicker.tsx` → `profiles/` | coupled: calls `fetch('/api/profiles')` in an effect, owns loading/error state | ~13 min (agent), about half of it e2e baseline verification. New seams it needed: `api/profiles_api.effect.lib.ts` + `profiles_schema.pure.lib.ts` (zod, tied to the OpenAPI type), `api/http.pure.lib.ts` (shared `HttpFetch`), and `query/` (`useQuery` + `QueryState`, the server-state seam). Split into a props-only view (all states renderable) + `bindProfilePicker({ listProfiles })` + `assembleProfilePicker()`. Shared exports moved out: `ProfileAvatar` → `profiles/profile_avatar.pure.ui.tsx`, `AVATAR_OPTIONS` → `profiles/avatar_options.pure.lib.ts`, `PENCIL_ICON` → `den/icon_paths.pure.lib.ts`. The 8 legacy tests (which mocked `global.fetch`) are ported; 34 tests + 8 stories now. e2e: no change vs. baseline (see Known debt). |

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
| `components/{CoachPanel,WritingSurface,IllustrationReveal,ModifierDeck}.tsx` → `writing/`, plus `timing/` and `api/pieces_api` | ~35 min (agent) | The shared writing pipeline, migrated ahead of the four writing games. `timing/` adds a `Timers` capability (`after`, `every`) with component-scoped `useScheduled`, plus a `manualTimers()` test clock, replacing four components' worth of hand-rolled `setTimeout` refs. IllustrationReveal became `bindIllustrationReveal({ generateIllustration, timers })` with its phase machine in `use_illustration_reveal`. ModifierDeck split into card data with a pure `drawCard(pool, random)`, a bound deck, and a props-only rule bar. Both textareas gained accessible names. Legacy games assemble the reveal once at module scope until they migrate. 4 legacy files out. |
| `games/PromptForge.tsx` → `prompt_forge/` | ~25 min (agent) | First writing game on the shared pipeline: `writing/use_revision_pass` (coach thinking → questions → save piece + the game's own records + revision), `WritingGameDeps` (`pieces`, `timers`, `random`, `createId`), and the bound reveal injected as a component. The forge rules became `forge_recipe.pure.lib.ts`; the twist draw takes the injected random. The flip card's bare `<div onClick>` was dropped because the labelled "Flip the twist" button does the same job accessibly. Game tests use `StubReveal` and a manual clock, with no `fetch` stub. 2 legacy files out. |
| Pathfinder (`lib/pathfinder*`, `lib/usePathfinderPlay`, `lib/fakePathfinderApi`, `components/Pathfinder*`, `games/Pathfinder`) → `pathfinder/` | ~60 min (agent, separate worktree) | The engine (rules, solver, difficulty, generator, levels, export) moved as pure libs with only strict-mode fixes; the generator already took a seeded `rng`. Every fetch is now `api/pathfinder_api.effect.lib.ts` (zod; `difficulty` parsed as the four tiers, stricter than the schema's `string`). New capabilities in `pathfinder_state.pure.lib.ts`: `LevelProgressStore`, `MapLibrary`, `ListPublishedMaps`, `ScheduleTimeout` (the invalid-move flash), `Dialogs` (`window.confirm`/`prompt`), `SubscribeToFocus` (published-list refresh). Effects moved to hooks (`use_level_progress`, `use_published_maps`, `useQuery`/`useReloadableQuery` for the map lists). React-compiler debt fixed: `usePathfinderPlay` no longer resets via set-state-in-effect; its attempt is tagged with the puzzle id. The game and play-test now share `pathfinder_play_panel.pure.ui.tsx`. Child screens are injected (`bindPathfinderMapBuilder({ Editor, MyMaps, PlayTest })`, `bindPathfinder({ LevelSelect, PublishedMaps, MapBuilder, ... })`). `fakePathfinderApi` (a `global.fetch` stub) became an in-memory capability fake plus an HTTP-level fake inside the adapter test. Wall-clock perf assertions became node-count / no-assertion checks (the `no-unstable-scenario-test` rule). My Maps buttons gained per-map accessible names (`Delete Spiral`). 35 legacy files out; 240 unit tests, 25 stories. |
| `games/StyleRemixLab.tsx`, `games/TagTeamStory.tsx` → `style_remix/`, `tag_team/` | ~30 min (agent) | Both on the shared writing pipeline; the remixes and turns save through `use_revision_pass`'s `afterCreate`. Content and rules became pure libs (`remix_styles`, `tag_team_story`: `drawStyle`, `chooseStory`, `nextTurn`, `aiLine`, `wordShare`). Three effects were really event handlers. Style Remix's "draw on entering the phase" became a `useState` initializer plus the Draw-another handler. Tag-Team's "AI plays when it's its turn" and "assemble when full" became `addTurn`, which schedules the next AI line or moves to assembly. Leaving mid-thread now cancels the pending AI turn. Shelf buttons gained `aria-pressed` and short names (`Pick News Report`); the textareas gained labels. 4 legacy files out. |
| `components/Storybook.tsx`, `components/StorybookEntryCard.tsx` → `story_library/` | ~25 min (agent) | Reuses `api/pieces_api`, `writing/illustration_style`, and `query/`. The per-piece illustration fan-out became one pure loader over the adapter (`loadLibrary`, `loadShelfPeek`, the latter never rejecting, as before). Split into props-only `StoryLibraryView`, `EntryCardView`, and `Cover` over `QueryState`, plus `bindStoryLibrary({ loadLibrary, removePiece, confirm })` and `bindStorybookEntryCard({ loadPeek })`. `window.confirm` is an injected capability read only in assembly. A delete now re-reads the library (`useReloadableQuery`) instead of filtering a local copy. Callers key both by profile id. 3 legacy files out. |
| `games/ClueMaster.tsx` → `clue_master/` | ~20 min (agent) | Last writing game. Case files and the deal became `case_files.pure.lib.ts` (`dealCase` never repeats the case just dealt). Both effects were event handlers: the deal moved to a `useState` initializer, and the 1.4 s "reading it back" now starts when saving succeeds. "Play it again" remounts a keyed round component instead of resetting ten state variables by hand, which also resets the coach. 2 legacy files out. |
| `components/ErrorBoundary.tsx`, `lib/errorReporting.ts`, `games/GamePicker.tsx` → `errors/`, `home/` | ~20 min (agent) | Error reporting became a `ReportError` capability (`bindErrorReporting({ fetch, page })`) and `installGlobalErrorReporting` over a narrow `ErrorEventTarget`. `window` listeners and `location.reload` are named only in `errors.assembly.main.ts`; the class boundary is bound over `{ report, reload }`. `main.tsx` calls `assembleErrorHandling()` once. GamePicker became a props-only `GamePickerView` over a `QueryState` plus `bindGamePicker({ listGames })`; the roster trim is `home_games.pure.lib.ts`, and the unused `onOpenStorybook` prop is gone. 5 legacy files out. |
| Equation Outbreak, the whole zombie/3D cluster (54 legacy files: `lib/zombie*`, lanes, colliders, characters, weapon, audio, the R3F scene components, `games/framework/*`, `ZombieMathBlaster`, `EquationOutbreakSettings`, the dev zombie labs, `e2e/zombie-hit-lab.spec.ts`) → `zombies/`, `arena/`, `science_fair/`, `blaster/`, `outbreak/`, `motion/`, `zombie_lab/` | one long agent session | The arena (`bindZombieArena`) takes its 3D view as a bind arg (`Viewport`), so its suites run over a plain-DOM viewport and a virtual clock: the four ported ZombieMathBlaster suites went from ~2 min of real waiting with `vi.mock` of the scene to well under a second, with none. Its effect chain (feedback on `wave.lastHit`, outcome on `wave.outcome`, lives on `phase`) became transitions where the cause happens (`use_arena_session.pure.hook.ts`), so each fires once by construction. New seams: `ArenaScheduler` (timers + frame loop), `ArenaAudio` (`bindGameAudio` over an injected context, loader, and storage: no module singletons), `ArenaRoster`, `MotionPreference`, items/attempts/ratings/practice-config adapters, and `AsyncBoundary`'s `onError` (it works inside `<Canvas>`, so every R3F `<Suspense>` now has one, and a failed scene shows a message instead of an empty canvas). Zombie hit targets are a typed WeakMap (`arena/raycast_tags`) instead of `any` userData. `@react-three/test-renderer` 9.1.1 (dev only) tests the 3D pieces without WebGL over a synthetic GLTF; stories run them in Chromium with the real models. 53 src files + 1 e2e spec out. |
| `App.tsx`, `main.tsx`, `dev/DevScreenPicker.tsx`, `types/generated.ts`, and the legacy scaffolding → `main/` | ~45 min (agent) | The shell last. App's ten independent booleans, picked by precedence, became one `Screen` union with a pure transition per user action (`app_navigation.pure.lib.ts`). `bindApp({ screens, Overlay })` takes every screen injected. `assembleRoot()` holds the only `window.location` / `import.meta.env.DEV` reads, and `entry.assembly.main.ts` (what `index.html` loads) mounts it with `createElement`, since assembly has no JSX. The dev picker became `bindDevScreens(deps)` plus a props-only picker. `types/generated.ts` and its generator were deleted. Then the scaffolding went: both allowlists, `tsconfig.legacy.json`, the oxlint legacy override, `srcFile`, and the backend's `is_checked`. `e2e/` gained a strict `tsconfig.e2e.json`; it had been typechecked by nothing. |
Lessons:
- **Most effects in legacy screens are event handlers in disguise.** "When phase becomes X, do Y" belongs in whatever sets phase to X. Moving it there removes the effect, the `exhaustive-deps` disable, and the stale-closure bugs together.
- **Look for the copy-paste before the component.** Two "different" games were one session loop with different payloads. Migrate the shared loop once (`practice/`) and each game shrinks to a parser and a view.
- **Inject a child component when a screen embeds a stateful panel** (`PhotoCapture: ComponentType<…>`). `bind*` can't be called outside assembly, so the parent's assembly binds the child and passes it in.
- **Module-level `new Date()` is a hidden global.** `Date.now` is linted; `new Date()` isn't yet. Pass `today` in.
- **Labels that grow hints break `getByLabelText`.** Hold on to the input element across edits.
- **Tag per-item state with its key instead of resetting it in an effect** (`usePathfinderPlay`'s attempt carries `puzzleId`; a different puzzle reads as a fresh attempt). That's what clears `react/set-state-in-effect` without forcing callers to remount.
- **A fake that seeds asynchronously races the first load in a story.** Give in-memory fakes a synchronous `seed` for setup.
- **Don't assert on locale dates in tests:** a UTC timestamp renders as the previous day in a US timezone.
- **Inject the expensive view, not just the data.** A `Viewport` bind arg made the zombie arena's lifecycle testable in jsdom with a dozen buttons standing in for the 3D scene.
- **Effects that watch state to react to an event are a smell.** The arena's "when `lastHit` changes, flash; when `outcome` changes, score" effects became calls at the event itself; the double-fire guards (`handledOutcomeRef` and friends) mostly disappeared with them.
- **Time-based R3F motion should sum frame deltas,** not read `state.clock`: identical in the browser, and the test renderer (which doesn't advance the clock) can then drive it.
- **A null guard can expose a vacuous test.** The legacy "reached carrier can't be hit" engine test passed `null!` as the carrier id, because nothing ever reached the player in its 1 s tick.

## Open follow-ups

- **The zombie arena re-renders every frame:** the wave engine's state lives in React state
  and the frame loop sets it each tick (as it did before migrating). The 3D side is
  allocation-free per frame (aim quaternion, lane positions, muzzle flash), but moving the
  wave into a ref read by `useFrame` would cut the React work too. Measure before changing.
- **`outbreak/`'s `ArenaScheduler` overlaps `timing/`'s `Timers`.** Both inject timers; the
  arena's also schedules animation frames. Unify them when one of them next changes.
- **Dev screens duplicate some stories.** The `?screen=` demos of props-only components
  (session shell, tile board, writing pieces) now also exist as Storybook stories; the live,
  backend-hitting screens are the dev picker's real value. Prune the demos if they drift.

Resolved along the way: the local Chrome 155 that exited after ~5.7 s (e2e and Storybook
use Playwright's bundled Chromium, as CI does); `<Suspense>` without an error boundary in
the R3F scenes (now `AsyncBoundary`, which works inside `<Canvas>`); the React-compiler
violations in the scene, blaster, muzzle flash, deck, and Pathfinder; `global.fetch` mocks
in tests (every test injects fakes through `bind*`); the timing-flaky e2e hit-lab spec
(waits on a ready signal); and `types/generated.ts` (retired with `make gen-types`).
