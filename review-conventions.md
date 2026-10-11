# Review conventions (for the AI PR reviewer)

Lint, types, import-linter and the tests already enforce everything in
[DEPENDENCIES.md](DEPENDENCIES.md) and [AGENTS.md](AGENTS.md). **Don't re-review those**:
if CI is green, they're satisfied. Review only what a machine can't check yet. When the
same comment comes up again and again, propose a lint rule for it instead (see
`frontend/scripts/lint/AGENTS.md`).

## Structure

- **Organize by feature, not kind.** A new folder named for a kind of thing (`helpers/`,
  `shared/`, `common/`) is a feature with no name; ask what domain it serves. A folder past
  ~30 files usually wants a split into grouping folders.
- **Inject the narrowest capability.** `{ replaceAll }`, not the API client.
  `() => { id } | null`, not the user. A read-only consumer gets no setter. Flag `bindX`
  args that are wider than what the body uses.
- **Components are surface-agnostic.** They take `onOpenFile`, not the router. They don't
  inspect the URL, the current screen, or who rendered them.
- **State stays with its owner.** Async results must land on the instance that started
  them, even if the user navigated away in between. Look for operations that write into
  shared state instead of into bound commands, and for a second copy of a value that
  already has a writer.
- **Code is cheap to write, expensive to own.** Prefer deleting and simplifying. Push back
  on speculative options, unused exports, and abstractions with one caller. A feature
  should be deletable as one folder.
- **The diagrams still tell the truth.** `make check-docs` only proves every folder is drawn. If the PR changes a data flow, migrates a component, adds an endpoint group or external service, or changes CI, check that `docs/architecture/*.mmd` was redrawn to match (`docs/architecture/AGENTS.md`).
- **Consistency beats cleverness.** New code should look like `examples/todo/`. A novel
  pattern needs a reason in the PR description.

## Tests

- **Assert observable results, not internal calls.** "The row shows as done and the save
  holds `done: true`", not "`setTodos` was called".
- **Fake external dependencies, not the behavior under test.** A fake that always succeeds
  hides the failure path. A constant hook hides updates. Every async UI needs its failure
  and its pending state tested.
- **Tests come from the acceptance criteria**, not from reading the implementation. If a
  test would still pass with the feature's core logic deleted, it isn't testing the feature.
- **New UI ships a story** with a `play` function for its main interaction and its error state.

## Rewrites

- Port **behavior**, not just JSX: focus management, IME/composition input, scroll position,
  disabled and loading states, keyboard shortcuts, error recovery. Diff the old and new
  behavior, not the markup.
