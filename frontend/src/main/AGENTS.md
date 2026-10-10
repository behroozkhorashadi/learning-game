# src/main — the frontend composition root

The top of the dependency graph. Files here are `*.assembly.main.ts`: they call each
feature's `assembleX()` and hand the results to whatever renders them. Nothing imports
from here except the legacy shell (and tests).

- `dev_screens.assembly.main.ts` registers new-style screens for the `?screen=` dev picker
  (`src/dev/DevScreenPicker.tsx`, legacy). Each entry's `assemble` is called **once**, when
  the picker mounts it. Add your feature's screen here to drive it in the real app with
  `make dev`, then `?screen=<id>`.
- The production shell (`src/main.tsx`, `src/App.tsx`) is still legacy. As screens
  migrate, it moves here: one `assembleApp()` that reads globals once and passes bound
  components down. Until then, legacy calls into these assemblies, never the reverse.
- Assembly rules apply: no JSX, no component declarations, `bind*` and `assemble*` only
  inside functions, and globals and flags read here and injected.
