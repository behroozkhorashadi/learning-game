# src/main — the frontend shell and composition root

The top of the dependency graph. Nothing imports from here except tests.

- `entry.assembly.main.ts` is what `index.html` loads: it installs error handling
  (`errors/`), then mounts `assembleRoot()` on `#root`.
- `app.assembly.main.ts`: `assembleAppScreens()` calls every feature's `assembleX()` once;
  `assembleRoot()` returns the app, or, in dev builds with `?screen=`, the dev picker.
- `app.effect.ui.tsx`: `bindApp({ screens, Overlay })` routes between the injected screens.
  Where the app is lives in one value, `app_navigation.pure.lib.ts`'s `Screen` union, with
  a pure transition per user action. A new screen is a new union member, a transition, and
  a field in `AppScreens`.
- `dev_screens.*`: the `?screen=` catalogue. `bindDevScreens(deps)` returns zero-prop
  screens over mock data (`dev_fixtures.pure.lib.ts`) and the live bound screens; add a
  feature's screen there to drive it in the real app with `make dev`.
- Assembly rules apply: no JSX (use `createElement`), no component declarations, `bind*` and
  `assemble*` only inside functions, globals and flags read here and injected.
