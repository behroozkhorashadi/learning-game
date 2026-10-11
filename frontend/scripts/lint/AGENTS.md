# scripts/lint — the local oxlint plugin

Rules that stand in for walls the language can't build. Config: `frontend/oxlint.config.ts`.
Loaded through `jsPlugins` as TypeScript (Node ≥ 22.18 strips types natively).

## Layout

```
plugin.ts          registers every rule under the `app/` prefix
kinds.ts           filename grammar + COLOR_ALLOWED / KIND_ALLOWED (the single source)
paths.ts           src root, import resolution (`@app/*`, extensions)
rule_utils.ts      shared AST helpers + DOCS links
rule_tester.ts     oxlint RuleTester wired to vitest
architecture/  components/  security/  state/  testing/  types/
                   one rule per file, each with a colocated <rule>.test.ts
docs_sync.test.ts  the DEPENDENCIES.md / FILE_NAMING_CONVENTION.md tables match kinds.ts
```

## Maintenance contract

- **Prefer a stock rule** (oxlint built-ins, `typescript/*`, `react/*`, `no-restricted-imports`)
  before writing a custom one. A custom rule is code we own.
- **Adding a rule** takes four things in one PR: the rule file, its registration in
  `plugin.ts`, an `'error'` entry in `oxlint.config.ts`, and `<rule>.test.ts` with valid and
  invalid cases. Nothing is `warn`.
- **Every message says where the code goes instead**, and links a doc via `see(...)`. An
  agent must be able to fix the violation from the message alone.
- **Rules self-gate** on the paths they govern (`governedFile()`: every `.ts(x)` under
  `src/`). That keeps them inert on tooling.
- **Import-policy rules resolve against the real `src/` tree.** Test fixtures must import
  files that actually exist (the example's files are the usual targets). The importing
  `filename` itself doesn't need to exist.
- **Changing the matrix or the grammar** means updating `kinds.ts`, `DEPENDENCIES.md`, and
  `FILE_NAMING_CONVENTION.md` in the same PR. `docs_sync.test.ts` fails until they agree.
- **Cycle detection is not a lint rule.** It's `scripts/check_cycles.ts` (the whole graph,
  Tarjan SCC, type-only edges allowed). Don't add `import/no-cycle`, since it can't allow
  type-only cycles.
- **There are no exemptions.** No allowlist, and `app/no-disable-comments` rejects
  `oxlint-disable` in `src/`. A rule that's wrong for a case is changed here, in review.

Run: `npm run test:lint-rules` (rules, cycles, docs sync) and `npm run lint`.
