# scripts/lint_py — backend AST rules and the color contract

| file | what |
|---|---|
| `naming.py` | **The** filename grammar: `parse_module_filename`, `Color`, `KIND_COLORS`, reserved tokens |
| `color_contract.py` | `color_layers` import-linter contract (layer matrix, pure-externals allowlist, feature independence, nothing imports `app.main`) |
| `rule_*.py` | one AST rule each: `check(source, project) -> Iterable[Violation]` |
| `test_*.py` | one test per rule, plus naming and contract tests |
| `run.py` | runner: `python -m scripts.lint_py.run [files...]` |

Maintenance contract:
- **Prefer a stock check first** (ruff rule, ruff `banned-api`, a stock import-linter contract,
  pyright setting). Write a custom rule only when those can't express it.
- Adding a rule means the `rule_<name>.py` file, registration in `run.py` `RULES`, a
  `test_rule_<name>.py` with passing and failing cases, and a section in `backend/AGENTS.md`
  that the message links to. All in one PR.
- Every message says **where the code should go instead** and links `backend/AGENTS.md#<section>`.
- Rules gate themselves on the paths they govern (`source.is_app`, `source.is_test`,
  `source.module_name`).
- Changing the grammar or layer matrix means updating `naming.py`, `color_contract.py`,
  `backend/AGENTS.md`, and root `DEPENDENCIES.md` / `FILE_NAMING_CONVENTION.md` **in the same PR**.
  The docs and the code must never disagree.
