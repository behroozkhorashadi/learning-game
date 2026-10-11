# Backend migration: legacy → feature/color layout (done)

All 67 pre-guardrail files are migrated or deleted. `scripts/lint_py/legacy_allowlist.txt` is
empty and `MAX_LEGACY_FILES` is 0. New backend code follows `AGENTS.md` from the start; this
file records how the migration went, for the next codebase that tries it.

## What stayed identical

- **The API contract.** Every URL, status code, error `detail`, operation id, and published
  schema (names, fields, docstrings) is byte-identical: `make check-api` showed no diff after
  every step, and the legacy `frontend/src/types/generated.ts` (`make gen-types`) is unchanged (both since retired, with the frontend shell migration).
  Wire models keep pydantic's default `extra="ignore"` for that reason, and some keep docstrings
  that mention old module paths (they're operation descriptions; changing them is a frontend
  regeneration, best done in a frontend PR).
- **The database.** Every table keeps its name and columns; enums are still stored by name
  (`ITEM_SHOWN`, `FACES`, `KID`), JSON columns keep their shape, password hashes keep the
  `scrypt$salt$digest` format, and photo/illustration paths are unchanged. Checked by creating a
  database with the pre-migration backend and reading it back with the migrated one.
- **Seeded randomness.** The game generators make the same draws in the same order; tests use a
  seeded splitmix64 fake instead of `random.Random`, which is banned outside assembly.

## What changed on purpose

- **Cross-feature foreign keys are gone from fresh databases.** Each feature owns its tables in
  its own `MetaData`, so `attempt.profile_id` (say) can't name `profile.id`. SQLite never
  enforced them (foreign keys are off by default); intra-feature keys
  (`illustration.piece_id → piece.id`) remain. Existing databases keep their DDL.
- **Deleting a profile is one transaction per feature**, not one for everything: profiles calls
  an injected `erase_profile_data` that runs each feature's `delete_for_profile`.
- **Configuration is read once, at startup** (`AppSettings`, from the environment and
  `backend/.env`): `OPENAI_API_KEY` and friends no longer change behavior mid-run, and an unknown
  `IMAGE_PROVIDER` fails at startup instead of on the first illustration request.
- **OpenAI failures are caught narrowly** (HTTP, parse, decode errors) instead of `except
  Exception`; responses are parsed with pydantic.
- **Deterministic ordering:** Loop A's window and other `created_at`-ordered queries now break
  ties by id (two rows with the same timestamp used to come back in arbitrary order).
- **Asset scripts run as modules** (`python -m scripts.generate_word_audio`); the `make gen-*`
  targets do this.

## How it was done

One commit per route group, each green (`scripts/preflight.sh`, `make check-api`,
`make check-docs`): practice-config, pathfinder, the client-error sink (`crash_reports/`: `client`
is a reserved kind token), profiles + admin, play (games, Loop A, attempts, ratings,
verifications) + the event log, badges + pieces (which retired `app/main.py`'s routes), then the
entry point, `app/__init__.py`, the tooling scripts, and the test package.

While both coexisted, legacy routes read new-style storage through handles that assembly
returned to `app/main.py`, and new features reached legacy data through small adapters in
assembly. The one trap: SQLite's write lock. A legacy session holding a write (or a read
transaction re-opened by `session.refresh`) blocks a write from another connection, so writes
that crossed the boundary had to run inside the legacy session's own transaction, or after it
closed.

## Lessons

- **Migrate the leaves everyone reads first** (profiles) only if you can afford the adapters;
  here the cheapest order was the reverse: the self-contained groups first, then the shared core.
- **Features never importing each other** turned the old shared-session joins into explicit
  ports (`PlayNeighbors`, `BadgeNeighbors`, `erase_profile_data`). Each is a few lines in
  assembly, and each documents a real dependency that used to be invisible.
- **Pin the contract mechanically.** Exporting OpenAPI and diffing it after every step caught
  the only real drift (a model that gained a docstring, which became a schema description).
